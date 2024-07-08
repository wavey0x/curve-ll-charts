from flask import Flask, send_from_directory, request, jsonify
from flask_cors import CORS
import os
import glob

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:3001"}})  # Allow CORS for React app origin

# Serve the most recent chart JSON
@app.route('/charts/<chart_name>/<peg>')
def get_chart(chart_name, peg):
    peg_str = 'True' if peg.lower() == 'true' else 'False'
    pattern = os.path.join('charts', f"{chart_name}_{peg_str}_*.json")
    files = glob.glob(pattern)
    if not files:
        return "File not found", 404
    latest_file = max(files, key=os.path.getctime)
    return send_from_directory(os.path.dirname(latest_file), os.path.basename(latest_file))

# Handle description saving
@app.route('/description', methods=['POST'])
def save_description():
    data = request.get_json()
    filename = data['filename']
    description = data['description']
    with open(f"charts/{filename}.txt", 'w') as f:
        f.write(description)
    return jsonify({'message': 'Description saved'})

if __name__ == '__main__':
    if not os.path.exists('charts'):
        os.makedirs('charts')
    # Listen on all available IP addresses
    app.run(host='0.0.0.0', port=5000, debug=True)
