FROM python:3.12-slim

WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install dependencies
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy project files
COPY . .

# Collect static files
RUN python manage.py collectstatic --noinput

# Expose port
EXPOSE 8000

# Command to run the application
CMD ["gunicorn", "--worker-class", "gthread", "--workers", "3", "--threads", "2", "prompt_enhancer_backend.wsgi:application", "--bind", "0.0.0.0:8000"]
