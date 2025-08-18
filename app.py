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

class UserWeekInfo(db.Model):
    __tablename__ = 'user_week_info'

    account = db.Column(db.String, primary_key=True)
    week_id = db.Column(db.Integer, primary_key=True)
    token = db.Column(db.String)
    user_weight = db.Column(db.Numeric(30, 18))
    user_balance = db.Column(db.Numeric(30, 18))
    user_boost = db.Column(db.Numeric(30, 18))
    user_stake_map = db.Column(db.JSON)
    user_rewards_earned = db.Column(db.Numeric(30, 18))
    ybs = db.Column(db.String)
    global_weight = db.Column(db.Numeric(30, 18))
    global_stake_map = db.Column(db.JSON)
    start_ts = db.Column(db.Integer)
    start_block = db.Column(db.Integer)
    end_ts = db.Column(db.Integer)
    end_block = db.Column(db.Integer)
    start_time_str = db.Column(db.String)
    end_time_str = db.Column(db.String)

    def to_dict(self):
        return {
            'account': self.account,
            'week_id': self.week_id,
            'token': self.token,
            'user_weight': float(self.user_weight),
            'user_balance': float(self.user_balance),
            'user_boost': float(self.user_boost),
            'user_stake_map': self.user_stake_map,
            'rewards_earned': float(self.user_rewards_earned),
            'ybs': self.ybs,
            'global_weight': float(self.global_weight),
            'global_stake_map': self.global_stake_map,
            'start_ts': self.start_ts,
            'start_block': self.start_block,
            'end_ts': self.end_ts,
            'end_block': self.end_block,
            'start_time_str': self.start_time_str,
            'end_time_str': self.end_time_str,
        }
    
class UserInfo(db.Model):
    __tablename__ = 'user_info'

    account = db.Column(db.String, primary_key=True)
    week_id = db.Column(db.Integer, primary_key=True)
    token = db.Column(db.String)
    weight = db.Column(db.Numeric(30, 18))
    balance = db.Column(db.Numeric(30, 18))
    boost = db.Column(db.Numeric(30, 18))
    map = db.Column(db.JSON)
    rewards_earned = db.Column(db.Numeric(30, 18))
    ybs = db.Column(db.String)
    def to_dict(self):
        return {
            'account': self.account,
            'week_id': self.week_id,
            'token': self.token,
            'weight': float(self.weight),
            'balance': float(self.balance),
            'boost': float(self.boost),
            'map': self.map,
            'rewards_earned': float(self.rewards_earned),
            'ybs': self.ybs
        }



@app.route('/user_info', methods=['GET'])
def get_user_info():
    # Query the database with pagination
    account = request.args.get('account', 1, type=str)
    week_id = request.args.get('week_id', 1, type=int)
    print(account)
    print(week_id)
    results = UserWeekInfo.query.filter_by(account=account, week_id=week_id).all()
    
    if not results:
        return jsonify([])
    
    results_json = [user_info.to_dict() for user_info in results]
    return jsonify(results_json)

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

# Serve raw chart data for Recharts
@app.route('/api/crvlol/chart-data/<chart_type>/<peg>')
def get_chart_data(chart_type, peg):
    try:
        # Load the cached data
        with open('./data/ll_info.json', 'r') as file:
            cache_data = json.load(file)
        
        if 'chart_data' not in cache_data:
            return jsonify({"error": "Chart data not found in cache"}), 404
        
        chart_data = cache_data['chart_data']
        
        # Map chart types to cache keys
        chart_mapping = {
            'Weekly_APRs': 'weekly_aprs' if peg.lower() == 'false' else 'weekly_aprs_peg',
            'APR_Since': 'apr_since' if peg.lower() == 'false' else 'apr_since_peg'
        }
        
        if chart_type not in chart_mapping:
            return jsonify({"error": "Invalid chart type"}), 400
        
        data_key = chart_mapping[chart_type]
        if data_key not in chart_data:
            return jsonify({"error": f"Chart data for {chart_type} not found"}), 404
        
        # Convert ISO date strings back to timestamps for Recharts
        raw_data = chart_data[data_key]
        formatted_data = []
        
        for item in raw_data:
            # Convert ISO date string to timestamp
            if isinstance(item['date'], str):
                from datetime import datetime
                date_obj = datetime.fromisoformat(item['date'].replace('Z', '+00:00'))
                timestamp = int(date_obj.timestamp() * 1000)  # Convert to milliseconds
            else:
                timestamp = item['date']
                
            formatted_item = {
                'date': timestamp,
                'asdCRV': float(item.get('asdCRV', 0)) * 100,  # Convert to percentage
                'yvyCRV': float(item.get('yvyCRV', 0)) * 100,
                'ucvxCRV': float(item.get('ucvxCRV', 0)) * 100,
            }
            formatted_data.append(formatted_item)
        
        return jsonify(formatted_data)
        
    except FileNotFoundError:
        return jsonify({"error": "Cache file not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    if not os.path.exists('charts'):
        os.makedirs('charts')
    # Listen on all available IP addresses
    app.run(host='0.0.0.0', port=8000, debug=True)
