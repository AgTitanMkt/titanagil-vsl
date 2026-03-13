import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    def __init__(self):
        self.DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://admin:rootadmin@localhost:3306/vsl_dashboard")
        self.SQLALCHEMY_URL = self.DATABASE_URL
        self.PORT = int(os.getenv("PORT", "8050"))
        self.DEBUG = os.getenv("DEBUG", "true").lower() == "true"
        self.REDTRACK_API_KEY = os.getenv("REDTRACK_API_KEY", "")
        self.VTURB_API_KEY = os.getenv("VTURB_API_KEY", "")

settings = Settings()
