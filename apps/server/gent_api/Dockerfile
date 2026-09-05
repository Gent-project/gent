FROM python:3.11-slim

# Python optimizations
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=100

# Set working directory
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --retries 3 --timeout 100 -r requirements.txt

# Copy project files
COPY . .

# Make entrypoint script executable
RUN chmod +x entrypoint.sh

# Create non-root user for security
RUN useradd -m -u 1000 django && chown -R django:django /app
USER django

# Expose port
EXPOSE 8000

# Run entrypoint script
ENTRYPOINT ["./entrypoint.sh"]
