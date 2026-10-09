FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY pyproject.toml ./
COPY app ./app
RUN pip install .
COPY alembic ./alembic
COPY alembic.ini ./
RUN useradd --create-home appuser
USER appuser
EXPOSE 8000
