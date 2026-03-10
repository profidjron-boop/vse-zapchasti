from locust import HttpUser, between, task


class PublicApiSmokeUser(HttpUser):
    wait_time = between(0.2, 1.0)

    @task(3)
    def health(self):
        self.client.get("/health", name="GET /health")

    @task(2)
    def public_content(self):
        self.client.get("/api/public/content", name="GET /api/public/content")

    @task(2)
    def categories(self):
        self.client.get("/api/public/categories", name="GET /api/public/categories")

    @task(1)
    def products(self):
        self.client.get(
            "/api/public/products?limit=12", name="GET /api/public/products"
        )
