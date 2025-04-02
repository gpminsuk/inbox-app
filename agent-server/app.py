from langchain_google_genai import ChatGoogleGenerativeAI
from browser_use import Agent, Browser, BrowserConfig, BrowserContextConfig
from browser_use.browser.views import BrowserState
from browser_use.agent.views import AgentOutput
from pydantic import SecretStr
import os
from dotenv import load_dotenv
load_dotenv()

import os
import logging
import threading
import concurrent.futures
import asyncio
import json
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from db import update_action_status, create_log_entry
import datetime

api_key = os.getenv("GEMINI_API_KEY")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("agent-server.log")
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Thread pool for async operations
executor = concurrent.futures.ThreadPoolExecutor(max_workers=5)
agent_tasks = {}

@app.route('/health', methods=['GET'])
def health_check():
    """Simple health check endpoint"""
    return jsonify({"status": "healthy"}), 200

@app.route('/run-agent', methods=['POST'])
def run_agent():
    """
    Run an agent task with browser-use asynchronously
    
    Expected JSON payload:
    {
        "prompt": "The task to perform",
        "url": "Optional starting URL",
        "timeout": 60,  # Optional timeout in seconds
        "actionId": "Required action ID to update when completed"
    }
    """
    global agent_tasks
    
    try:
        data = request.json
        
        if not data or 'prompt' not in data:
            return jsonify({"error": "Missing required parameter: prompt"}), 400
            
        if not data.get('actionId'):
            return jsonify({"error": "Missing required parameter: actionId"}), 400
        
        prompt = data['prompt']
        action_id = data['actionId']
        
        logger.info(f"Starting async agent with prompt: {prompt}, actionId: {action_id}")
        
        # Create agent with the model
        agent = Agent(
            task=prompt,
            llm=ChatGoogleGenerativeAI(model='gemini-2.0-flash-exp', api_key=SecretStr(os.getenv('GEMINI_API_KEY'))),
            browser=Browser(
                config=BrowserConfig(
                    headless=True,
                    new_context_config=BrowserContextConfig(save_recording_path='./tmp/recordings'),
                )
            ),
        )
        
        # Generate a task ID
        import uuid
        task_id = str(uuid.uuid4())
        
        # Update action status to running if action_id is provided
        update_action_status(action_id, "running")
        create_log_entry(
            f"Agent task started for action {action_id} with prompt: {prompt}",
            level="info"
        )
        
        # Define the async task
        async def async_agent_run():
            try:
                # Run the browser task
                result = await agent.run()
                return result
            except Exception as e:
                logger.error(f"Error in async agent run: {str(e)}", exc_info=True)
                raise e
        
        # Function to run in the thread
        def run_agent_task():
            try:
                # Create a new event loop for this thread
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
                # Run the async function and get the result
                result = loop.run_until_complete(async_agent_run())
                
                logger.info(f"Agent task {task_id} completed with result: {result}")
                
                # Store the result in our tasks dictionary
                agent_tasks[task_id] = {
                    "status": "completed",
                    "result": result,
                    "prompt": prompt,
                    "actionId": action_id
                }
                
                # Update the action status in the database
                try:
                    # Debug log to inspect the actual structure
                    logger.info(f"Result type: {type(result)}")
                    logger.info(f"Result dir: {dir(result)}")
                    
                    # Convert result to a structured JSON based on the actual structure
                    # The AgentHistoryList object has different attributes than expected
                    # Check if it's a string representation or an object with attributes
                    if hasattr(result, 'all_results'):
                        structured_result = {
                            "all_results": [
                                {
                                    "is_done": r.is_done,
                                    "success": r.success,
                                    "extracted_content": r.extracted_content,
                                    "error": r.error,
                                    "include_in_memory": r.include_in_memory
                                } for r in result.all_results
                            ],
                            "all_model_outputs": [
                                {k: (v if not isinstance(v, (dict, list)) else v) for k, v in output.items()}
                                for output in result.all_model_outputs
                            ]
                        }
                    else:
                        # If the result doesn't have the expected structure, 
                        # create a structured representation based on what's available
                        logger.info(f"Using alternate structure for result")
                        
                        # Convert the result to a string and parse it
                        result_str = str(result)
                        
                        # Check if it's the expected format with all_results
                        if "all_results=" in result_str:
                            # Extract action results using regex
                            import re
                            all_results_match = re.search(r'all_results=\[(.*?)\]', result_str, re.DOTALL)
                            all_results = []
                            
                            if all_results_match:
                                action_results = re.finditer(r'ActionResult\((.*?)\)', all_results_match.group(1), re.DOTALL)
                                for action_match in action_results:
                                    action_str = action_match.group(1)
                                    
                                    # Extract individual properties
                                    is_done_match = re.search(r'is_done=(.*?),', action_str)
                                    success_match = re.search(r'success=(.*?),', action_str)
                                    content_match = re.search(r'extracted_content=(.*?),', action_str)
                                    error_match = re.search(r'error=(.*?),', action_str)
                                    memory_match = re.search(r'include_in_memory=(.*?)(?:,|\))', action_str)
                                    
                                    all_results.append({
                                        "is_done": is_done_match and is_done_match.group(1) == 'True',
                                        "success": None if not success_match or success_match.group(1) == 'None' 
                                                  else success_match.group(1) == 'True',
                                        "extracted_content": None if not content_match or content_match.group(1) == 'None'
                                                           else content_match.group(1).strip("'"),
                                        "error": None if not error_match or error_match.group(1) == 'None'
                                               else error_match.group(1).strip("'"),
                                        "include_in_memory": memory_match and memory_match.group(1) == 'True'
                                    })
                            
                            # Extract model outputs
                            all_outputs_match = re.search(r'all_model_outputs=\[(.*?)\]', result_str, re.DOTALL)
                            all_outputs = []
                            
                            if all_outputs_match:
                                # This is complex to parse, so we'll create a simplified representation
                                outputs_str = all_outputs_match.group(1)
                                # Try to clean up the string for JSON parsing
                                outputs_str = outputs_str.replace("'", '"').replace('None', 'null')
                                outputs_str = outputs_str.replace('True', 'true').replace('False', 'false')
                                
                                try:
                                    # Try to parse as JSON
                                    import json
                                    all_outputs = json.loads(f"[{outputs_str}]")
                                except json.JSONDecodeError:
                                    # If parsing fails, create a simple representation
                                    logger.warning("Failed to parse model outputs as JSON")
                                    all_outputs = [{"output": f"Model output {i+1}"} for i in range(len(all_results))]
                            
                            structured_result = {
                                "all_results": all_results,
                                "all_model_outputs": all_outputs
                            }
                        else:
                            # Fallback for unexpected format
                            structured_result = {
                                "all_results": [
                                    {
                                        "is_done": True,
                                        "success": True,
                                        "extracted_content": str(result),
                                        "error": None,
                                        "include_in_memory": True
                                    }
                                ],
                                "all_model_outputs": [
                                    {"output": "Agent completed task"}
                                ]
                            }
                    
                    # Convert to JSON string for storage
                    result_json = json.dumps(structured_result)
                    
                    # Update the action status in the database
                    update_success = update_action_status(
                        action_id=action_id,
                        status="completed",
                        result=result_json
                    )
                    
                    # Create a log entry
                    create_log_entry(
                        f"Agent task completed for action {action_id}. Result: {str(result)[:200]}",
                        level="info"
                    )
                    
                    if update_success:
                        logger.info(f"Successfully updated action {action_id} to completed in database")
                    else:
                        logger.error(f"Failed to update action {action_id} in database")
                except Exception as e:
                    logger.error(f"Error updating action status in database: {str(e)}", exc_info=True)
                
                # Clean up
                loop.close()
            except Exception as e:
                logger.error(f"Error in agent task {task_id}: {str(e)}", exc_info=True)
                agent_tasks[task_id] = {
                    "status": "error",
                    "error": str(e),
                    "prompt": prompt,
                    "actionId": action_id
                }
                
                # Update the action status in the database
                try:
                    # Create a structured error object
                    error_obj = {
                        "error": str(e),
                        "timestamp": datetime.datetime.now().isoformat()
                    }
                    
                    # Update the action status in the database
                    update_success = update_action_status(
                        action_id=action_id,
                        status="error",
                        error=json.dumps(error_obj)
                    )
                    
                    # Create a log entry
                    create_log_entry(
                        f"Error in agent task for action {action_id}: {str(e)}",
                        level="error"
                    )
                    
                    if update_success:
                        logger.info(f"Successfully updated action {action_id} with error status in database")
                    else:
                        logger.error(f"Failed to update action {action_id} with error in database")
                except Exception as log_error:
                    logger.error(f"Error updating action error status in database: {str(log_error)}", exc_info=True)
        
        # Start the task in background
        agent_tasks[task_id] = {
            "status": "running", 
            "prompt": prompt,
            "actionId": action_id
        }
        executor.submit(run_agent_task)
        
        # Return immediately with task ID
        return jsonify({
            "success": True,
            "task_id": task_id,
            "status": "running",
            "prompt": prompt,
            "actionId": action_id
        }), 202
        
    except Exception as e:
        logger.error(f"Error setting up agent task: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/agent-status/<task_id>', methods=['GET'])
def get_agent_status(task_id):
    """Get the status of a running agent task"""
    if task_id not in agent_tasks:
        return jsonify({"error": "Task not found"}), 404
    
    task_info = agent_tasks[task_id]
    return jsonify(task_info), 200

@app.route('/action-status/<action_id>', methods=['GET'])
def get_action_status(action_id):
    """Get the status of an action by its ID"""
    # Find any task associated with this action ID
    for task_id, task_info in agent_tasks.items():
        if task_info.get('actionId') == action_id:
            return jsonify({
                "task_id": task_id,
                "status": task_info.get('status', 'unknown'),
                "result": task_info.get('result', None) if task_info.get('status') == 'completed' else None,
                "error": task_info.get('error', None) if task_info.get('status') == 'error' else None
            }), 200
    
    # If no task is found for this action
    return jsonify({"error": "No task found for this action ID"}), 404

if __name__ == '__main__':
    # Get port from environment variable or default to 8080
    port = int(os.environ.get('PORT', 8080))
    
    # Run the Flask app
    app.run(host='0.0.0.0', port=port, debug=os.environ.get('FLASK_DEBUG', 'False').lower() == 'true')
