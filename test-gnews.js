// test-gnews.js
const apiKey = '68fece31710bc1f716e33e22a8e5dc43'; // your key
const celebrity = 'Taylor Swift';
const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(celebrity)}&lang=en&max=5&apikey=${apiKey}`;
fetch(url)
  .then(r => r.json())
  .then(data => console.log(JSON.stringify(data, null, 2)))
  .catch(err => console.error(err));