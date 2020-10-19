const socket = io('/');
var user_id=0;
// btn.addEventListener('click',()=>{
//     let roomValue = roomID.value;
//     socket.emit('join_room',roomValue,user_id);
// });

socket.on('open_connection',(user_value)=>{
    user_id=user_value;
    console.log('User ID : ',user_id);
})

socket.on('client_message',(message)=>{    
    addItems(message);
    socket.emit('send_message','client message after connection');
})

socket.on("user_connected", (userId) => {
    addItems("New User connected : "+userId);    
});

socket.on("user_disconnect", (userId) => {
    addItems('User Remove : '+userId);    
});

const addItems = (message)=>{
    let li = document.createElement("li");
    li.innerText ="Message From Server : "+message;
    div.appendChild(li);
}