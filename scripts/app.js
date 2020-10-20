var MyApp = (function () {
  var socket = null;
  var socker_url = "/";
  var meeting_id = "";
  var user_id = "";
  const videoGrid = document.getElementById("video-grid");
  function init(uid, mid) {
    user_id = uid;
    meeting_id = mid;

    $("#meetingname").text(window.location.origin + "?mid=" + meeting_id);
    $("#share_link").val(window.location.origin + "?mid=" + meeting_id);
    $("#me p").text(user_id + "(Me)");
    document.title = user_id;

    SignalServerEventBinding();
    EventBinding();
  }

  function SignalServerEventBinding() {
    // Set up the SignalR connection
    //$.connection.hub.logging = true;

    //_hub = $.connection.webRtcHub;
    //$.connection.hub.url = _hubUrl;

    socket = io.connect(socker_url);

    var serverFn = function (data, to_connid) {
      socket.emit("exchangeSDP", { message: data, to_connid: to_connid });
      //_hub.server.exchangeSDP(data, to_connid);
    };

    socket.on("reset", function () {
      location.reload();
    });

    socket.on("exchangeSDP", async function (data) {
      //alert(from_connid);
      await WrtcHelper.ExecuteClientFn(data.message, data.from_connid);
    });

    socket.on("informAboutNewConnection", function (data) {
      AddNewUser(data.other_user_id, data.connId);
      WrtcHelper.createNewConnection(data.connId);
    });

    socket.on("informAboutConnectionEnd", function (connId) {
      $("#id" + connId).remove();
      WrtcHelper.closeExistingConnection(connId);
    });

    socket.on("showChatMessage", function (data) {
      var div = $("<div>").text(
        data.from + "(" + data.time + "):" + data.message,
      );
      $("#messages").append(div);
    });

    socket.on("connect", () => {
      if (socket.connected) {
        WrtcHelper.init(serverFn, socket.id);

        if (user_id != "" && meeting_id != "") {
          socket.emit("userconnect", {
            dsiplayName: user_id,
            meetingid: meeting_id,
          });
          //_hub.server.connect(user_id, meeting_id)
        }
      }
    });

    socket.on("userconnected", function (other_users) {
      $("#divUsers .other").remove();
      if (other_users) {
        for (var i = 0; i < other_users.length; i++) {
          AddNewUser(other_users[i].user_id, other_users[i].connectionId);
          WrtcHelper.createNewConnection(other_users[i].connectionId);
        }
      }
      $(".toolbox").show();
      $("#messages").show();
      $("#divUsers").show();
    });
  }

  function EventBinding() {
    $("#btnResetMeeting").on("click", function () {
      socket.emit("reset");
    });

    $("#btnsend").on("click", function () {
      //_hub.server.sendMessage($('#msgbox').val());
      socket.emit("sendMessage", $("#msgbox").val());
      $("#msgbox").val("");
    });

    $("#divUsers").on("dblclick", "video", function () {
      this.requestFullscreen();
    });
  }

  function AddNewUser(other_user_id, connId) {
    let box = document.createElement("div");
    let userName = document.createElement("p");

    userName.classList = ["float-right h6 px-3 text-white"];
    userName.innerText = other_user_id;
    box.className = "box";
    box.id = "id" + connId;

    let video = document.createElement("video");
    let audio = document.createElement("audio");
    video.muted = true;
    video.autoplay = true;
    video.controls = false;
    video.id = "v_" + connId;

    audio.id = "a_" + connId;

    audio.style.display = "none";

    box.appendChild(video);
    box.appendChild(audio);
    box.appendChild(userName);
    videoGrid.appendChild(box);
    // var $newDiv = $("#otherTemplate").clone();
    // $newDiv = $newDiv.attr("id", connId).addClass("other");
    // $newDiv.find("h2").text(other_user_id);
    // $newDiv.find("video").attr("id", "v_" + connId);
    // $newDiv.find("audio").attr("id", "a_" + connId);
    // $newDiv.show();
    // $("#divUsers").append($newDiv);
  }

  return {
    _init: function (uid, mid) {
      init(uid, mid);
    },
  };
})();
