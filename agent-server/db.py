import os
import psycopg2
import logging
import re
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Database connection URL
DATABASE_URL = os.getenv("DATABASE_URL")

def get_db_connection():
    """Get a connection to the PostgreSQL database."""
    try:
        if not DATABASE_URL:
            logger.error("DATABASE_URL environment variable is not set")
            raise ValueError("DATABASE_URL environment variable is not set")
        
        # Remove the schema parameter from the URL as psycopg2 doesn't support it
        # Example: postgresql://user:pass@localhost:5432/dbname?schema=public
        # Convert to: postgresql://user:pass@localhost:5432/dbname
        clean_url = re.sub(r'\?schema=.*', '', DATABASE_URL)
        
        # Connect using the cleaned DATABASE_URL
        conn = psycopg2.connect(clean_url)
        logger.info("Connected to database using DATABASE_URL")
        
        # If there was a schema parameter, set the search_path
        if "schema=" in DATABASE_URL:
            schema_match = re.search(r'schema=([^&]*)', DATABASE_URL)
            if schema_match:
                schema = schema_match.group(1)
                cursor = conn.cursor()
                cursor.execute(f'SET search_path TO {schema}')
                conn.commit()
                cursor.close()
                logger.info(f"Set database schema to {schema}")
        
        return conn
    except Exception as e:
        logger.error(f"Error connecting to database: {str(e)}")
        raise

def update_action_status(action_id, status, result=None, error=None):
    """Update the status of an action in the database."""
    if not action_id:
        logger.warning("No action ID provided, skipping database update")
        return False
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if status == "completed":
            # First update the status in metadata
            cursor.execute(
                """
                UPDATE "Action" 
                SET "metadata" = jsonb_set(
                        COALESCE("metadata", '{}'::jsonb), 
                        '{agentStatus}', 
                        '"completed"'
                    ),
                    "updatedAt" = NOW()
                WHERE "id" = %s
                """,
                (action_id,)
            )
            
            # Then update the result in metadata
            cursor.execute(
                """
                UPDATE "Action" 
                SET "completed" = TRUE,
                    "metadata" = jsonb_set(
                        COALESCE("metadata", '{}'::jsonb), 
                        '{agentResult}', 
                        %s::jsonb
                    ),
                    "updatedAt" = NOW()
                WHERE "id" = %s
                """,
                (result if result else '""', action_id)
            )
        elif status == "running":
            # Update the action status to running
            cursor.execute(
                """
                UPDATE "Action" 
                SET "completed" = FALSE,
                    "metadata" = jsonb_set(
                        COALESCE("metadata", '{}'::jsonb), 
                        '{agentStatus}', 
                        '"running"'
                    ),
                    "updatedAt" = NOW()
                WHERE "id" = %s
                """,
                (action_id,)
            )
        elif status == "error":
            # First update the status in metadata
            cursor.execute(
                """
                UPDATE "Action" 
                SET "metadata" = jsonb_set(
                        COALESCE("metadata", '{}'::jsonb), 
                        '{agentStatus}', 
                        '"error"'
                    ),
                    "updatedAt" = NOW()
                WHERE "id" = %s
                """,
                (action_id,)
            )
            
            # Then update the error in metadata
            cursor.execute(
                """
                UPDATE "Action" 
                SET "metadata" = jsonb_set(
                        COALESCE("metadata", '{}'::jsonb), 
                        '{agentError}', 
                        %s::jsonb
                    ),
                    "updatedAt" = NOW()
                WHERE "id" = %s
                """,
                (error if error else '""', action_id)
            )
        
        conn.commit()
        cursor.close()
        conn.close()
        logger.info(f"Successfully updated action {action_id} to {status}")
        return True
    except Exception as e:
        logger.error(f"Error updating action status: {str(e)}")
        if 'conn' in locals() and conn:
            conn.close()
        return False

def create_log_entry(message, level="info", source="agent-server", user_id=None):
    """Create a log entry in the database."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            """
            INSERT INTO "Log" ("id", "message", "level", "source", "userId", "timestamp")
            VALUES (gen_random_uuid(), %s, %s, %s, %s, NOW())
            """,
            (message, level, source, user_id)
        )
        
        conn.commit()
        cursor.close()
        conn.close()
        logger.info(f"Created log entry: {message}")
        return True
    except Exception as e:
        logger.error(f"Error creating log entry: {str(e)}")
        if 'conn' in locals() and conn:
            conn.close()
        return False
