#!/usr/bin/env python3
"""
Test script for the agent server.
This allows you to test the browser-use functionality locally.
"""

import requests
import json
import sys
import time

def test_agent(prompt, url=None):
    """Test the agent server with a prompt."""
    print(f"Testing agent with prompt: {prompt}")
    
    payload = {
        "prompt": prompt,
        "timeout": 120  # 2 minutes timeout
    }
    
    if url:
        payload["url"] = url
    
    try:
        response = requests.post(
            "http://localhost:8080/run-agent",
            json=payload,
            timeout=180  # 3 minutes timeout for the request
        )
        
        if response.status_code == 200:
            result = response.json()
            print("\n✅ Agent task completed successfully!")
            print(f"\nResult: {json.dumps(result, indent=2)}")
            return True
        else:
            print(f"\n❌ Error: {response.status_code}")
            print(response.text)
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"\n❌ Request failed: {str(e)}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_agent.py \"Your prompt here\" [optional_url]")
        sys.exit(1)
    
    prompt = sys.argv[1]
    url = sys.argv[2] if len(sys.argv) > 2 else None
    
    print("Starting agent server test...")
    print("Make sure the agent server is running on http://localhost:8080")
    print("You can start it with: python app.py")
    print("\nPress Ctrl+C to cancel at any time.")
    print("=" * 50)
    
    time.sleep(2)  # Give user time to read instructions
    
    test_agent(prompt, url)
