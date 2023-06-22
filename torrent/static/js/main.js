import WebTorrent from 'https://esm.sh/webtorrent';

document.getElementById('magnetForm').addEventListener('submit', function(event) {
  event.preventDefault();

  const magnetLink = document.getElementById('magnetLink').value;
  var client = new WebTorrent();

  console.log(client);
  client.add(magnetLink, function (torrent) {
    // Print out info
    var info = {
      name: torrent.name,
      files: torrent.files.map(file => file.name),
      peers: Object.keys(torrent.peers),
    };
    console.log(info);
    document.getElementById('info').innerText = JSON.stringify(info, null, 2);
  }).on('error', function (err) {
    console.log(err);
  });
});
