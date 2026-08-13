FROM python:3.12-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libjpeg62-turbo \
        libtiff6 \
        libopenjp2-7 \
        zlib1g \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 1000 knitter

COPY requirements.txt .
RUN python -m venv /opt/kpp \
    && /opt/kpp/bin/pip install --no-cache-dir -r requirements.txt

COPY --chown=knitter:knitter . .

USER knitter
EXPOSE 8000

CMD ["/opt/kpp/bin/python", "server.py"]