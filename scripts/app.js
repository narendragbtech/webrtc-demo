var MyApp = (function () {
  var socket = null;
  var socker_url = "/";
  var meeting_id = "";
  var user_id = "";
  var _other_users = [];
  const videoGrid = document.getElementById("remote_users");

  function init(uid, mid) {
    user_id = uid;
    meeting_id = mid;

    $("#meetingname").text(
      window.location.origin + "/meeting/?mid=" + meeting_id,
    );
    $("#share_link").val(
      window.location.origin + "/meeting/?mid=" + meeting_id,
    );
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

    var serverErrorReport = function (data) {
      socket.emit("client_Error_Report", data);
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
        WrtcHelper.init(serverFn, serverErrorReport, socket.id);

        if (user_id != "" && meeting_id != "") {
          socket.emit("userconnect", {
            displayName: user_id,
            meetingId: meeting_id,
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
    let existVideoGroup = document.getElementById("id" + connId);
    if (!existVideoGroup) {
      let video_group_div = document.createElement("div");
      video_group_div.className = "video-group";
      video_group_div.id = "id" + connId;
      let bottom_row_div = document.createElement("div");
      bottom_row_div.className = "bottom-row";

      let action_button_audio_status = document.createElement("div");
      action_button_audio_status.className = "action-button";
      action_button_audio_status.id = "remote_audio_status_" + connId;

      let action_button_div_id = document.createElement("div");
      action_button_div_id.id = "remote_user_name_" + connId;
      action_button_div_id.className = "action-button";
      action_button_div_id.innerText = other_user_id;

      let video = document.createElement("video");
      video.poster = "/image/waiting.svg";
      video.volume = 0;
      video.muted = true;
      video.autoplay = true;
      video.controls = false;
      video.id = "v_" + connId;

      let audio = document.createElement("audio");
      audio.id = "a_" + connId;
      audio.autoplay = true;
      audio.controls = true;
      audio.volume = 0.9;
      audio.style.display = "none";

      bottom_row_div.appendChild(action_button_audio_status);
      bottom_row_div.appendChild(action_button_div_id);
      video_group_div.appendChild(bottom_row_div);
      video_group_div.appendChild(video);
      video_group_div.appendChild(audio);

      videoGrid.appendChild(video_group_div);
      updateLayout();
    }
    // var $newDiv = $("#otherTemplate").clone();
    // $newDiv = $newDiv.attr("id", connId).addClass("other");
    // $newDiv.find("h2").text(other_user_id);
    // $newDiv.find("video").attr("id", "v_" + connId);
    // $newDiv.find("audio").attr("id", "a_" + connId);
    // $newDiv.show();
    // $("#divUsers").append($newDiv);
  }

  function updateLayout() {
    let remote_users = $("#remote_users")[0].children.length;
    if (remote_users == 0) {
      $(".my-video").css({
        width: " 100%",
        height: "100%",
        position: "absolute",
        "z-index": "0",
      });
    } else {
      $(".my-video").css({
        width: "125",
        height: "150px",
        position: "fixted",
        "z-index": "999",
      });
      if (remote_users === 1) {
        $("#remote_users").addClass("remote-one-to-one");
      } else {
        $(".video-group .bottom-row").css({
          top: "0",
        });
        if (remote_users > 2) {
          $("#remote_users").addClass("remote-one-to-many");
        }
      }
    }
  }

  return {
    _init: function (uid, mid) {
      init(uid, mid);
    },
    _updateLayout: function () {
      updateLayout();
    },
  };
})();
