import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URI')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # CORS_ORIGINS = os.getenv('CORS_ORIGINS', '*')  # Allow all origins by default
