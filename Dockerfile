FROM python:3.14-slim

WORKDIR /app

# Install Deps
COPY ./requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Install application code
COPY ./catalog.py ./server.py ./
COPY ./static ./static

# Run as abc user (UID 1000, GID 1000) to match LinuxServer.io containers.
# /app/config holds the catalog state and must be writable by that user.
RUN groupadd -g 1000 abc && \
    useradd -u 1000 -g abc abc && \
    mkdir -p /app/config && \
    chown abc:abc /app/config
USER abc

VOLUME /app/config
EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s \
    CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:5001/health')"

ENTRYPOINT [ "python3", "server.py" ]
