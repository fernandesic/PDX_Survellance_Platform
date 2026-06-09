const axios = require('axios');
axios.get('http://localhost:8000/api/v1/sentinel/signals/', { withCredentials: true })
  .then(res => console.log('SUCCESS:', res.data.results?.length || res.data.length))
  .catch(err => console.log('ERROR:', err.response ? err.response.status : err.message));
