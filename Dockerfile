FROM python:3.14-slim

# The release version, passed by CI. It becomes the service worker's cache name,
# so a release hands a knitter the new shell instead of the cached old one.
ARG APP_VERSION=dev

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

RUN sed -i "s|\"kpp-shell-[^\"]*\"|\"kpp-shell-${APP_VERSION}\"|" web/sw.js

USER knitter
EXPOSE 8000

# Two workers, because a parse is seconds of scipy and a single-threaded server
# makes the app look offline to the next request — the one thing this app must
# never lie about. The timeout is raised for the same reason: the largest chart
# in the corpus is not a 30-second request.
CMD ["/opt/kpp/bin/gunicorn", "--workers", "2", "--timeout", "120", "--bind", "0.0.0.0:8000", "server:app"]
