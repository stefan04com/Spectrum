from flask import Flask
from flask_cors import CORS

from database import init_db
from routes.auth_routes import auth_bp
from routes.child_routes import child_bp
from routes.parent_routes import parent_bp

app = Flask(__name__)
CORS(app)

init_db()

# înregistrăm blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(child_bp)
app.register_blueprint(parent_bp)

@app.route("/")
def home():
    return "Autism MVP Backend Running (Avatar AI Mode)"

if __name__ == "__main__":
    app.run(debug=True)
