const express = require('express')

const path =require('path');
const app = express();
const { v4: uuidV4 } = require("uuid");
const server = require('http').Server(app);

const io = require('socket.io')(server)
app.use(express.static(__dirname+"/public"));

app.get('/',(req,res)=>{
//   res.redirect('/home');
  res.sendFile(path.join(__dirname,"index.html"));
});

app.get('/home',(req,res)=>{
    res.sendFile(path.join(__dirname,"index.html"));
})


io.on("connection",(socket)=>{
    socket.on('join_room',(roomID,user_id)=>{
        console.log(user_id,roomID);

        socket.join(roomID);
        socket.to(roomID).broadcast.emit('user_connection',user_id);
        socket.on("disconnect", () => {
            socket.to(roomID).broadcast.emit("user_disconnect", user_id);
        });
    });

    socket.on('sendToPeer',(roomID,message)=>{
      
        socket.to(roomID).broadcast.emit('sendToPeer',message);
    })

    socket.emit('open_connection',uuidV4());
});

const listener = server.listen(8080,()=>{
    console.log('server running ',listener.address().port);

});

