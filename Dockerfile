FROM python:3

# Install Deps
COPY ./requirements.txt /
RUN pip install -r requirements.txt
RUN apt update && apt install -y docker.io

# Install application code
COPY ./*.py /
COPY ./static /static

# Run as abc user (UID 1000, GID 1000) to match LinuxServer.io containers
RUN groupadd -g 1000 abc && \
    useradd -u 1000 -g abc abc
USER abc

ENTRYPOINT [ "python3", "server.py" ]
