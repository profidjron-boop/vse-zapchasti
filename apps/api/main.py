from fastapi import FastAPI

app = FastAPI(title="Все запчасти API", version="0.1.0")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/")
def root() -> dict:
    return {"service": "vse-zapchasti-api"}
