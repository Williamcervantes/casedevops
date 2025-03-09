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

# Change the working directory to inside 'testapp'
WORKDIR /app/testapp

# Verify that manage.py exists
RUN ls -l /app/testapp

# install gunicorn
RUN pip install gunicorn

# Collect static files (if applicable)
RUN python manage.py collectstatic --noinput || echo "Skipping collectstatic"

# Expose the port Django runs on
EXPOSE 8000

# Run migrations and start the application
CMD ["sh", "-c", "python manage.py migrate && gunicorn testapp.wsgi:application --bind 0.0.0.0:8000"]