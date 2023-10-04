const express = require('express');
const socketIO = require('socket.io');
const http = require('http');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const port = 12345;

app.get('/', (_, res) => {
  res.sendFile(__dirname + '/index.html');
});

const connectedUsers = {}; // 객체로 변경하여 사용자 목록을 저장

io.on('connection', (socket) => {
  console.log('소켓 서버 접속');

  let username;

  socket.on('join', (data) => {
    username = data.username;
    socket.broadcast.emit('join', { username });
    connectedUsers[socket.id] = username; // 사용자를 연결된 소켓 ID와 함께 저장
    emitUserList();
  });

  function emitUserList() {
    const userList = Object.values(connectedUsers); // 객체에서 사용자 이름 목록만 추출
    socket.emit('user list', { userList });
    socket.broadcast.emit('user list', { userList });
  }

  socket.on('client message', (data) => {
    io.emit('server message', {
      username: username,
      message: data.message,
    });
  });

  socket.on('disconnect', () => {
    delete connectedUsers[socket.id]; // 연결이 해제된 소켓 ID에 해당하는 사용자 삭제
    emitUserList();
    socket.broadcast.emit('leave', { username });
  });
});

server.listen(port, () => {
  console.log(`현재 ${port}번을 이용하여 접속중입니다.`);
});
