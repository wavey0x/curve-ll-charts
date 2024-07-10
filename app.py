from flask import Flask, send_from_directory, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import os, json, glob
from config import Config

app = Flask(__name__)

# Configuration for the database
app.config.from_object(Config)

CORS(app)  # This will enable CORS for all routes

# Initialize the database
db = SQLAlchemy(app)

class CrvLlHarvest(db.Model):
    __tablename__ = 'crv_ll_harvests'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    profit = db.Column(db.Numeric(30, 18))
    timestamp = db.Column(db.Integer)
    name = db.Column(db.String)
    underlying = db.Column(db.String)
    compounder = db.Column(db.String)
    block = db.Column(db.Integer)
    txn_hash = db.Column(db.String)
    date_str = db.Column(db.String)

# Endpoint to return records from the crv_ll_harvests table
@app.route('/harvests', methods=['GET'])
def get_harvests():
    # Get query parameters for pagination
    page = request.args.get('page', 1, type=int)
    page = 1 if page < 1 else page
    per_page = request.args.get('per_page', 20, type=int)
    per_page = 20 if per_page < 1 or per_page > 100 else per_page
    
    # Calculate the offset
    offset = (page - 1) * per_page
    
    # Query the database with pagination
    harvests = CrvLlHarvest.query.order_by(CrvLlHarvest.timestamp.desc()).offset(offset).limit(per_page).all()
    
    # Get the total number of records for pagination metadata
    total = CrvLlHarvest.query.count()
    
    results = [
        {
            "id": harvest.id,
            "profit": str(harvest.profit),
            "timestamp": harvest.timestamp,
            "name": harvest.name,
            "underlying": harvest.underlying,
            "compounder": harvest.compounder,
            "block": harvest.block,
            "txn_hash": harvest.txn_hash,
            "date_str": harvest.date_str
        } for harvest in harvests
    ]
    
    return jsonify({
        'page': page,
        'per_page': per_page,
        'total': total,
        'data': results
    })

@app.route('/info')
def ll_info():
    try:
        # Open the JSON file and load its contents
        with open('./data/ll_info.json', 'r') as file:
            data = json.load(file)
        # Return the JSON data as a response
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
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
