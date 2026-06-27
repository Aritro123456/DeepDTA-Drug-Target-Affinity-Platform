from .auth import auth_bp
from .datasets import datasets_bp
from .health import health_bp
from .model_proxy import model_proxy_bp
from .notebooks import notebooks_bp
from .static import static_bp
from .visualization import visualization_bp


def register_blueprints(app):
    app.register_blueprint(auth_bp)
    app.register_blueprint(datasets_bp)
    app.register_blueprint(health_bp)
    app.register_blueprint(model_proxy_bp)
    app.register_blueprint(notebooks_bp)
    app.register_blueprint(visualization_bp)
    app.register_blueprint(static_bp)
