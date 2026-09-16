# Contributing

Thanks for your interest in Beets Monitor!

## Development setup

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt pytest
cp .env.example .env   # then fill in your values
```

Run the app with `python3 server.py` (listens on port 5001) and the tests with
`pytest`.

## Pull requests

- Keep changes focused; one feature or fix per PR.
- Add or update tests in `tests/` for behavior changes.
- Make sure `pytest` passes and `docker build .` succeeds.
- Update `README.md` and `.env.example` when adding configuration.

## Reporting bugs

Open an issue using the bug report template. Include logs
(`docker logs beets_monitor`) with any tokens or API keys removed.
