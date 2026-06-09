import os
import sys
import time
import schedule
import requests
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("hdis_cron.log"),
        logging.StreamHandler()
    ]
)

SUPABASE_URL = "https://uxbvvzcngdjkhvszkibm.functions.supabase.co"

def trigger_ingestion():
    """Triggers the Supabase Edge Function to ingest new sources and generate alerts."""
    logging.info("Starting intelligence ingestion...")
    try:
        response = requests.post(
            f"{SUPABASE_URL}/ingest-sources",
            headers={"Content-Type": "application/json"},
            json={},
            timeout=120 # Give it time to hit the AI gateway
        )
        response.raise_for_status()
        logging.info(f"Ingestion successful: {response.json()}")
    except requests.exceptions.RequestException as e:
        logging.error(f"Ingestion failed: {e}")

def trigger_briefing():
    """Triggers the Supabase Edge Function to generate the daily executive briefing."""
    logging.info("Starting daily briefing generation...")
    try:
        response = requests.post(
            f"{SUPABASE_URL}/generate-briefing",
            headers={"Content-Type": "application/json"},
            json={"briefing_type": "daily"},
            timeout=120 # Give it time to hit the AI gateway
        )
        response.raise_for_status()
        logging.info(f"Briefing generation successful: {response.json()}")
    except requests.exceptions.RequestException as e:
        logging.error(f"Briefing generation failed: {e}")

def run_daily_pipeline():
    """Runs the full pipeline sequentially."""
    logging.info("--- STARTING DAILY HDIS PIPELINE ---")
    trigger_ingestion()
    
    # Wait 30 seconds for alerts to finalize before generating briefing
    time.sleep(30)
    
    trigger_briefing()
    logging.info("--- FINISHED DAILY HDIS PIPELINE ---")

if __name__ == "__main__":
    logging.info("HDIS Cron Scheduler Started.")
    logging.info("Pipeline scheduled to run every 30 minutes.")
    
    # Run immediately on startup
    run_daily_pipeline()
    
    # Schedule the job every 30 minutes
    schedule.every(30).minutes.do(run_daily_pipeline)
    
    # Keep the script running
    try:
        while True:
            schedule.run_pending()
            time.sleep(60)
    except KeyboardInterrupt:
        logging.info("HDIS Cron Scheduler Stopped.")
        sys.exit(0)
