const express = require('express');         // 미들웨어 사용을 위해서 추가
const bodyParser = require('body-parser');  // 바디부 파싱을 위한 기능
const mysql = require('mysql');             // mysql과 연동하기 위한 모듈 추가
const session = require('express-session'); // 미들에어와 세션의 연동
const crypto = require('crypto');           // 비밀번호를 해시화 할 때 필요한 모듈 추가

const app = express();                      // 미들웨어 기능 추가

app.use(express.static('public'));          // public 폴더를 사용하기 위해 기능 추가

app.use(session({                           // 세션을 유지하는 기능
  secret: '12321',
  resave: true,
  saveUninitialized: true
}));

const connection = mysql.createConnection({ // MySQL 연결 설정, createConnection옵션을 통해 자동으로 db와 연동
  host: 'localhost',
  user: 'root',
  password: '111111',
  database: 'nodetest',
});

connection.connect((err) => {               // DB와 연동하기 위해 작업중 실패 시 종료, 성공 시 연결문구 생성
  if (err) {
    console.error('연결에 실패했습니다:', err);
    return;
  }
  console.log('MySQL 데이터베이스에 연결되었습니다.');
});

app.set('view engine', 'ejs');              // 페이지 표현을 위한 뷰 엔진 생성, 바디 파싱을 통한 앱 모듈 사용
app.use(bodyParser.urlencoded({ extended: false }));

app.get('/', (req, res) => {                // 사이트 접속 시 루트페이지에 대한 클라이언트의 응답을 index페이지로 반환
  res.render('index');
});

// 회원가입 폼 렌더링 (회원가입 페이지 이동)
app.get('/register', (req, res) => {        // 회원가입 사이트 접속 요청시 register 페이지로 반환
  res.render('register');
});

// 회원가입 처리 (회원가입 데이터 처리)
app.post('/register', (req, res) => {       // 회원가입에 대한 처리를 위해 post방식으로 처리요청
  const { id, password, email } = req.body; // 요청 바디부에 id,pw,email의 3가지를 가져옴
  const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
                                            // 비밀번호 부분만 sha256으로 해시화
  const user = { id, password: hashedPassword, email };
                                            // 가져온 데이터들을 user라는 변수에 저장
  connection.query('INSERT INTO users SET ?', user, (err) => {
    if (err) {                              // 쿼리문 작성을 통해 유저에 대한 기록을 DB에 저장
      console.error(err);                   // 실패시 에러문구가 나옴
      return res.status(500).send('An error occurred');
    }
    res.redirect('/login');                 // 성공시 로그인 페이지로 리다이렉트하고 서버에 문구 출력
    console.log(`${id}님께서 회원에 가입하셨습니다.`);
  });
});

// 로그인 폼 렌더링 (로그인 페이지 이동)
app.get('/login', (req, res) => {           // 로그인 요청을 받음
  res.render('login');                      // 로그인 페이지에 대한 요청 반환
});

// 로그인 처리 (로그인 데이터 처리)
app.post('/login', (req, res) => {          // 로그인 페이지에 대한 처리를 post 방식으로
  const { id, password } = req.body;        // 바디부에서 id,pw 데이터를 가져옴
  const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
                                            // 해시화 된 비밀번호를 대조하기 위함
  connection.query('SELECT * FROM users WHERE id = ? AND password = ?', [id, hashedPassword], (err, rows) => {
    if (err) throw err;                     // 쿼리를 작성하여 id와 pw에 대한 결과를 db와 비교함, 오류시 종료
    if (rows.length > 0) {                  // 길이가 0 이상일 경우 세션유저를 저장
      req.session.user = rows[0];           // 이후 게시판 페이지로 리다이렉트
      res.redirect('/board');
    } else {
      res.redirect('/login');               // 비교하여 존재하지 않을 때, 다시 로그인페이지로 반환
    }
  });
});

// 게시판 (게시판 페이지로 이동)
app.get('/board', (req, res) => {           // 게시판에 대한 연결 요청 처리
  if (!req.session.user) {                  // 연결 유저가 아닐 시 로그인 페이지로
    return res.redirect('/login');
  }
  const query = 'SELECT * FROM posts';        // 게시물 검색을 위한 정의. db의 포스트들을 저장

  connection.query(query, (err, rows) => {  // 쿼리를 실행, query의 경우 실행할 쿼리 문자열이고, 콜백 함수는 쿼리 실행결과를 받음
    if (err) throw err;                     // 오류 시 종료
    res.render('board', { posts: rows, isAdmin: req.session.user.id === 'admin', req: req });
  });                                       // 쿼리 실행 결과인 rows를 board.ejs에 렌더링하여 클라이언트에게 응답
});                                         // 렌더링 시 posts 변수에 rows 값을 전달
                                            // isAdmin 변수는 현재 사용자가 관리자인지 여부 req 객체를 전달 후 요청 정보 사용
// 글쓰기 폼 렌더링 (글 생성 페이지 이동)
app.get('/board/create', (req, res) => {    // create폼을 위한 요청과 응답
  if (!req.session.user) {                  // 세션에 연결된 유저가 아닐 시 로그인 페이지로
    return res.redirect('/login');
  }
  res.render('create');                     // 유저일 시 create페이지로 이동
});

// 글쓰기 처리 (글쓰기 데이터에 대한 처리)
app.post('/board/create', (req, res) => {   // 글쓰기 폼에 대한 처리를 위해 post 방식으로 요청
  if (!req.session.user) {                  // 세션에 연결된 유저가 아닐 시 로그인 페이지로
    return res.redirect('/login');
  }
  const { title, content } = req.body;      // 바디부에서 title, content에 대한 2가지 정보를 가져옴
  const post = { title, content, user_id: req.session.user.id };
                                            // 바디부에서 가져온 정보와 함께 총 4가지의 정보를 post 변수에 저장
  connection.query('INSERT INTO posts SET ?', post, (err) => {
    if (err) throw err;                     // 쿼리를 사용하여 posts DB에 4가지의 정보를 저장하고 에러 시 종료
    res.redirect('/board');                 // 성공 시 board 페이지로 리다이렉트
  });
});

// 게시물 수정 폼 렌더링 (수정 페이지 이동)
app.get('/board/edit/:id', (req, res) => {  // 수정을 위해 편집게시물 id 요청을 확인하여 응답을 결정하는 방식
  if (!req.session.user) {                  // 세션에 연결된 유저가 아닐 경우 로그인 창으로 반환
    return res.redirect('/login');
  }
  const postId = req.params.id;             // url에서 게시물 id를 가져와 변수를 클라이언트의 요청 게시물 id를 저장
  connection.query('SELECT * FROM posts WHERE id = ?', [postId], (err, rows) => {
    if (err) throw err;                     // DB에서 쿼리를 통해 DB와 요청받은 게시물의 id를 비교하고, 에러 시 종료
    if (rows.length === 0) {                // 길이를 비교하여 0일때(존재하지 않을 때) 게시판으로 이동
      return res.redirect('/board');
    }
    const post = rows[0];                   // 게시물을 rows 배열 첫번째에 저장
    if (post.user_id !== req.session.user.id && req.session.user.id !== 'admin') {
                                            // 현재 로그인 사용자와 저장된 아이디비교
      return res.redirect('/board');        // 다를 시 게시판으로 이동
    }
    res.render('edit', { post, req: req }); // 같을 시 edit를 렌더링하여 post와 req를 전달
  });                                       // 폼 구성 및 사용자에게 제공
});

// 게시물 수정 처리 (수정 페이지에 데이터 처리)
app.post('/board/edit/:id', (req, res) => { // 수정 게시물 id 요청을 확인하여 post방식의 수정 폼에 대한 응답을 결정하는 방식
  if (!req.session.user) {                  // 세션에 연결된 유저가 아닐 경우 로그인 창으로 반환
    return res.redirect('/login');
  }
  const postId = req.params.id;             // url에서 게시물 id를 가져와서 변수를 요청 게시물 id를 저장
  const { title, content } = req.body;      // 바디부에서 title과 content에 대한 정보를 가져옴
  const query = 'UPDATE posts SET ? WHERE id = ? AND (user_id = ? OR ? = "admin")';
                                            // placeholder부분에 받은 데이터를 posts DB에 대한 업데이트 사항을 쿼리로 저장 (게시물 id와 유저 id에 대해서 동일한지)
  connection.query(query, [{ title, content }, postId, req.session.user.id, req.session.user.id], (err, result) => {
    if (err) throw err;                     // 쿼리를 사용하여 4개의 자료에 대해서 실행하고 에러 시 종료
    if (result.affectedRows === 0) {        // 쿼리를 실행했지만 일치하는 행이 없는 경우 게시판으로 리다이렉트
      return res.redirect('/board');
    }
    res.redirect('/board');                 // 결과 반영할 시 게시판으로 리다이렉트
  });
});

// 게시물 삭제 폼 렌더링 (삭제 페이지 이동)
app.get('/board/delete/:id', (req, res) => {// 삭제 게시물 id 요청을 위한 응답을 결정하는 방식
  if (!req.session.user) {                  // 세션에 연결된 유저가 아닐 경우 로그인 창으로 변환
    return res.redirect('/login');
  }
  const postId = req.params.id;             // url에서 게시물 id를 가져와서 변수에 저장

  connection.query('SELECT * FROM posts WHERE id = ?', [postId], (err, rows) => {
    if (err) throw err;                     // 쿼리를 실행하여 id와 게시물 id가 존재하는지 확인하고 오류 시 종료
    if (rows.length === 0) {                // db에 저장된 게시물의 항목이 없을 경우 게시판으로 리다이렉트
      return res.redirect('/board');
    }
    const post = rows[0];                   // 있다면 post라는 변수에 그 값을 저장

    if (post.user_id !== req.session.user.id && req.session.user.id !== 'admin') {
      return res.redirect('/board');        // 게시물 id와 세션이 연결되어있는 유저의 id가 일치하지 않을 경우 게시판으로 리다이렉트
    }
    res.render('delete', { post, req: req });
  });                                       // 같을 시 delete를 랜더링하여 post와 req를 전달함, 폼 구성 및 사용자에게 제공
});

// 게시물 삭제 처리 (삭제 데이터의 처리)
app.post('/board/delete/:id', (req, res) => {
  if (!req.session.user) {                  // 삭제에 대한 처리를 위해 삭제 요청에 대한 id를 확인
    return res.redirect('/login');          // 세션에 연결된 유저가 아닐 경우 로그인 창으로 변환
  }
  const postId = req.params.id;             // url에서 게시물 id를 가져와서 변수에 저장

  connection.query('SELECT * FROM posts WHERE id = ?', [postId], (err, rows) => {
    if (err) throw err;                     // 쿼리에 실행하여 id와 게시물 id가 존재하는지 확인하고 오류 시 종료
    if (rows.length === 0) {                // db에 저장된 게시물이 없다면 게시판으로 이동
      return res.redirect('/board');
    }
    const post = rows[0];                   // 있다면 post라는 변수에 그 값을 저장

    if (post.user_id !== req.session.user.id && req.session.user.id !== 'admin') {
      return res.redirect('/board');        // 포스트 작성 id와 현재 연결된 유저가 동일하지 않다면 게시판으로 이동
    }
    connection.query('DELETE FROM posts WHERE id = ?', [postId], (err, result) => {
      if (err) {                            // 쿼리를 실행하여 요청에 대한 삭제를 진행
        console.error(err);                 // 에러 발생시 에러 메시지를 출력
        return res.status(500).send('서버측 에러 발생');
      }
      if (result.affectedRows === 0) {      // 쿼리를 실행했지만 일치하는 행이 없을 경우 404 메시지를 반환
        return res.status(404).send('게시물 찾을 수 없음');
      }
      res.redirect('/board');               // 정상적으로 삭제 시 게시판으로 이동
    });
  });
});

// 로그아웃 (세션 종료)
app.get('/logout', (req, res) => {          // 로그아웃에 대한 요청을 반환
  req.session.destroy();                    // 세션 정보 삭제와 함께 종료를 진행하고 루트 페이지로 이동
  res.redirect('/');
});

// 회원정보수정 폼 렌더링
app.get('/userEdit', (req, res) => {        // 회원정보 수정을 위한 요청을 반환
  res.render('userEdit');                   // userdit으로 이동
});

// 회원정보수정 처리 (정보 수정을 위한 id,pw 확인 절차)
app.post('/userEdit', (req, res) => {       // 정보 수정에 대한 요청
  const { id, password } = req.body;        // 아이디와 비밀번호를 확인하는 로직 구현
  const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
                                            // 해시화 된 비밀번호를 대조하기 위함
  connection.query(                         // 데이터베이스에서 아이디와 비밀번호 확인
    'SELECT * FROM users WHERE id = ? AND password = ?', [id, hashedPassword], (error, results) => {
      if (error) throw error;               // 에러 시 서버 종료
      if (results.length > 0) {             // 아이디와 비밀번호가 일치하는 사용자가 있는 경우
        const user = results[0];            // 사용자 정보를 가져와서 usereditpage 페이지로 전달
        res.render('userEditPage', { user });
      } else {                              // 아이디와 비밀번호가 일치하지 않는 경우 userdit을 반환
        res.render('userEdit');
      }
    }
  );
});

// 회원정보 수정 페이지
app.get('/userEditPage', (req, res) => {    // 회원정보 수정을 위한 요청, 이후 userditpage로 반환
  res.render('userEditPage');
});

// 회원정보 수정 처리
app.post('/userEditPage', (req, res) => {   // 새로운 이메일과 새로운 패스워드를 가져옴
  const { email, newPassword, confirmPassword } = req.body;
  if (newPassword !== confirmPassword) {    // 패스워드 확인, 불일치시 메시지 보냄
      return res.send("비밀번호가 일치하지 않습니다.");
  }
  const hashedPassword = crypto.createHash('sha256').update(newPassword).digest('hex');
                                            // 패스워드를 해시화하여 새로운 해시화된 패스워드를 생성
  connection.query(                         // 데이터베이스의 사용자 정보 수정 쿼리 작성, 적용될 때는 해시화하여 적용한다.
    'UPDATE users SET email = ?, password = ? WHERE id = ?', [email, hashedPassword, req.session.user.id], (error, results) => {
      if (error) throw error;               // 에러 시 서버 종료
      res.redirect('/board');               // 수정이 완료되면 게시판으로 이동
      console.log(`${req.session.user.id}님이 회원정보를 수정하셨습니다.`);
    }
  );
});

//회원탈퇴 폼 렌더링
app.get('/getout', (req, res) => {          // 회원 탈퇴에 대한 요청으로 getout 페이지로 응답
  res.render('getout');
});

//회원탈퇴 처리
app.post('/getout', (req, res) => {
  if (!req.session.user) {                  // 삭제에 대한 처리를 위해 삭제 요청에 대한 id를 확인
    return res.redirect('/login');          // 세션에 연결된 유저가 아닐 경우 로그인 창으로 이동
  }

  const id = req.session.user.id;           // 사용자가 입력한 아이디
  const password = req.body.password;       // 사용자가 입력한 비밀번호
  const email = req.session.user.email;     // 사용자가 입력한 이메일

  const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
  // 입력된 비밀번호를 SHA-256으로 해시화하여 데이터베이스의 해시화된 비밀번호와 비교

  connection.query('SELECT * FROM users WHERE id = ? and password = ?', [id, hashedPassword], (err, rows) => {
    if (err) throw err;                     // 쿼리에 실행하여 id와 pw가 존재하는지 확인하고 오류 시 종료
    if (rows.length === 0) {                // db에 저장된 게시물이 없다면 로그 출력하고 제자리
      console.log("일치하는 사용자가 없습니다.");
      return res.redirect('/getout');
    }
    const user = rows[0];                   // 있다면 user라는 변수에 그 값을 저장

    if (user.password !== hashedPassword) {
      console.log("세션 비밀번호가 데이터베이스의 비밀번호와 다릅니다.");
      return res.redirect('/getout');        // 입력 비밀번호와 현재 연결된 유저의 비밀번호가 다르다면 제자리
    }

    connection.query('DELETE FROM users WHERE id = ? and password = ? and email = ?', [id, hashedPassword, email], (err, result) => {
      if (err) {                            // 쿼리를 실행하여 요청에 대한 삭제를 진행
        console.error(err);                 // 에러 발생시 에러 메시지를 출력 (500)
        return res.status(500).send('서버측 에러 발생');
      }
      if (result.affectedRows === 0) {      // 쿼리를 실행했지만 일치하는 행이 없을 경우 404 메시지를 반환
        return res.status(404).send('유저 없음');
      }
      req.session.destroy();
      res.redirect('/');                    // 정상적으로 삭제 시 메인화면 이동
      console.log(`${id}님이 회원에서 탈퇴하셨습니다.`);
    });
  });
});

app.listen(8000, () => {                      // 80번 포트 실행 시 로그를 띄워주면서 서버 실행
  console.log(`8000번 포트를 연결하였습니다.`);
});
