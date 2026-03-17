FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for MySQL
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    default-libmysqlclient-dev \
    pkg-config \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for Docker layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -r appuser && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8050

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8050/api/health || exit 1

# Run with uvicorn (production )
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8050", "--workers", "2", "--timeout-keep-alive", "120"]