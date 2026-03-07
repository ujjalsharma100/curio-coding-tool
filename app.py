from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/')
def hello():
    return jsonify({'message': 'Welcome to Curio Code - Your AI Coding Assistant!'})

@app.route('/health')
def health():
    return jsonify({'status': 'healthy'})

@app.route('/api/info')
def api_info():
    return jsonify({
        'name': 'Curio Code API',
        'version': '1.0.0',
        'description': 'AI-powered coding assistant API'
    })

@app.route('/status')
def status():
    return jsonify({
        'service': 'running',
        'timestamp': '2024-03-07T16:53:33.116Z',
        'uptime': 'active'
    })

if __name__ == '__main__':
    app.run(debug=True)