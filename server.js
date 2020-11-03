const express = require("express");
const app = express();
const { v4: uuidV4 } = require("uuid");
const path = require("path");
app.use(express.static(__dirname + "/scripts"));

var _userConnections = [];
//routes
app.get("/", (req, res) => {
  if (!req.secure) {
    // res.redirect("https://" + req.headers.host + req.url);
    res.sendFile(path.join(__dirname, "home.html"));
  } else {
    res.sendFile(path.join(__dirname, "home.html"));
  }
});

app.get("/test", (req, res) => {
  if (!req.secure) {
    // res.redirect("https://" + req.headers.host + req.url);
    res.sendFile(path.join(__dirname, "test.html"));
  } else {
    res.sendFile(path.join(__dirname, "test.html"));
  }
});

app.get("/meeting", (req, res) => {
  res.sendFile(path.join(__dirname, "test.html"));
});

var port = process.env.PORT || 8080;
//Listen on port 3000
server = app.listen(port, () => {
  console.log(`Server Running on port ${port}`);
});

//socket.io instantiation
const io = require("socket.io")(server);

//listen on every connection
io.on("connection", (socket) => {
  console.log(socket.id);

  socket.on("client_Error_Report", (error) => {
    console.log(error.block, error.message);
  });

  socket.on("meeting_request", () => {
    socket.emit("on_meeting", uuidV4());
  });

  socket.on("userconnect", (data) => {
    // new user connection with display name and meeting id
    console.log(
      `New User ${data.displayName} is connection to meeting id ${data.meetingId}`,
    );

    // find all other user in same meeting id  from all user connection array
    var other_users = _userConnections.filter(
      (p) => p.meeting_id == data.meetingId,
    );

    // find new user already exists in userconnection or not
    let isUserExists = _userConnections.findIndex((existingUser) => {
      existingUser.user_id == data.displayName &&
        existingUser.meeting_id == data.meetingId;
    });

    // if it is not exists then push into user connection array  and broadcase new user displayName and connection id to other user in meeting.
    if (isUserExists === -1) {
      _userConnections.push({
        connectionId: socket.id,
        user_id: data.displayName,
        meeting_id: data.meetingId,
      });
      // join meeting
      socket.join(data.meetingId);
    } else {
      console.log(
        `${data.displayName} is already exists in ${data.meetingId} meeting...`,
      );
    }

    // broadcase user details to other user with same meeting id
    // socket.to(data.meetingId).broadcast.emit("informAboutNewConnection", {
    //   other_user_id: data.displayName,
    //   connId: socket.id,
    // });
    //  console.log("room user count : ", io.sockets.clients(data.meetingId));
    console.log(
      "broadcase user to meeting id users through inform About New Connection",
    );

    other_users.forEach((v) => {
      socket.to(v.connectionId).emit("informAboutNewConnection", {
        other_user_id: data.dsiplayName,
        connId: socket.id,
      });
    });

    // passing other user details to just connected new user is a array to user details
    socket.emit("userconnected", other_users);
  });

  socket.on("exchangeSDP", (data) => {
    socket
      .to(data.to_connid)
      .emit("exchangeSDP", { message: data.message, from_connid: socket.id });
  }); //end of exchangeSDP

  socket.on("reset", (data) => {
    var userObj = _userConnections.find((p) => p.connectionId == socket.id);
    if (userObj) {
      var meetingid = userObj.meeting_id;
      var list = _userConnections.filter((p) => p.meeting_id == meetingid);
      _userConnections = _userConnections.filter(
        (p) => p.meeting_id != meetingid,
      );

      // socket.to(meetingid).emit("reset");

      list.forEach((v) => {
        socket.to(v.connectionId).emit("reset");
      });

      socket.emit("reset");
    }
  }); //end of reset

  socket.on("sendMessage", (msg) => {
    console.log(msg);
    var userObj = _userConnections.find((p) => p.connectionId == socket.id);
    if (userObj) {
      var meetingid = userObj.meeting_id;
      var from = userObj.user_id;

      var list = _userConnections.filter((p) => p.meeting_id == meetingid);
      console.log(list);

      list.forEach((v) => {
        socket.to(v.connectionId).emit("showChatMessage", {
          from: from,
          message: msg,
          time: getCurrDateTime(),
        });
      });

      socket.emit("showChatMessage", {
        from: from,
        message: msg,
        time: getCurrDateTime(),
      });
    }
  }); //end of reset

  socket.on("disconnect", function () {
    console.log("Got disconnect!");

    var userObj = _userConnections.find((p) => p.connectionId == socket.id);
    if (userObj) {
      var meetingid = userObj.meeting_id;

      _userConnections = _userConnections.filter(
        (p) => p.connectionId != socket.id,
      );

      // socket.to(meetingid).emit("informAboutConnectionEnd", socket.id);
      var list = _userConnections.filter((p) => p.meeting_id == meetingid);
      list.forEach((v) => {
        socket.to(v.connectionId).emit("informAboutConnectionEnd", socket.id);
      });
    }
  });
});

function getCurrDateTime() {
  let date_ob = new Date();
  let date = ("0" + date_ob.getDate()).slice(-2);
  let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);
  let year = date_ob.getFullYear();
  let hours = date_ob.getHours();
  let minutes = date_ob.getMinutes();
  let seconds = date_ob.getSeconds();
  var dt =
    year +
    "-" +
    month +
    "-" +
    date +
    " " +
    hours +
    ":" +
    minutes +
    ":" +
    seconds;
  return dt;
}
