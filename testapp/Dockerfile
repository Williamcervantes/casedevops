# Use official Python image as the base
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Set the working directory inside the container
WORKDIR /app

# Copy only requirements first (for better caching)
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire application
COPY . /app

# Verify that manage.py exists
RUN ls -l /app

# Install gunicorn
RUN pip install gunicorn

# Expose the port Django runs on
EXPOSE 8000

# Entry point script to handle migrations and start the server
ENTRYPOINT ["sh", "/app/start.sh"]
