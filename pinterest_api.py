import os
from flask import Flask, request, jsonify
from pinterest import create_pin  # your existing create_pin function
import tempfile

app = Flask(__name__)

@app.route("/pin", methods=["POST"])
def pin():
    title = request.form.get("title")
    description = request.form.get("description")
    alt_text = request.form.get("alt_text")
    link = request.form.get("link")
    image_file = request.files.get("image_file")
    
    missing_fields = []
    if not title:
        missing_fields.append("title")
    if not description:
        missing_fields.append("description")
    if not alt_text:
        missing_fields.append("alt_text")
    if not link:
        missing_fields.append("link")
    if not image_file:
        missing_fields.append("image_file")

    if missing_fields:
        missing_str = ", ".join(missing_fields)
        return jsonify({"error": f"Missing required fields: {missing_str}"}), 400

    import tempfile, os
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(image_file.filename)[1]) as tmp:
            image_file.save(tmp.name)
            image_path = tmp.name

        create_pin(title, description, alt_text, link, image_path)
        os.remove(image_path)  # optional cleanup
        return jsonify({"message": "✅ Pin created successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)
