var WrtcHelper = (function () {
  const iceConfiguration = {
    iceServers: [
      {
        urls: "turn:turn.docango.com:5349",
        username: "admin",
        credential: "admin@123",
      },
      { urls: "stun:stun.docango.com:5349" },
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
    ],
  };

  var _audioTrack;

  var peers_conns = [];
  var peers_con_ids = [];

  var _remoteVideoStreams = [];
  var _remoteAudioStreams = [];

  var _localVideoPlayer;

  var _rtpVideoSenders = [];
  var _rtpAudioSenders = [];

  var _serverFn;
  var front = true;
  var VideoStates = { None: 0, Camera: 1, ScreenShare: 2 };
  var _videoState = VideoStates.Camera;
  var _videoCamSSTrack;
  var _isAudioMute = true;
  var _my_connid = "";
  var _serverErrorReport;
  async function _init(serFn, serverErrorReport, myconnid) {
    _my_connid = myconnid;
    _serverFn = serFn;
    _serverErrorReport = serverErrorReport;
    _localVideoPlayer = document.getElementById("localVideoCtr");
    _localVideoPlayer.muted = true;
    _localVideoPlayer.volume = 0;
    eventBinding();
    await ManageVideo(VideoStates.Camera);
  }

  function eventBinding() {
    $("#btnMuteUnmute").on("click", async function () {
      if (!_audioTrack) {
        await startwithAudio();
      }

      if (!_audioTrack) {
        alert("problem with audio permission");
        return;
      }

      if (_isAudioMute) {
        _audioTrack.enabled = true;
        $("#btnMuteUnmute_text").text("Mute");
        $("#icon-unmute").removeClass("d-none");
        $("#icon-mute").addClass("d-none");
        AddUpdateAudioVideoSenders(_audioTrack, _rtpAudioSenders);
      } else {
        _audioTrack.enabled = false;
        $("#btnMuteUnmute_text").text("Unmute");
        $("#icon-unmute").addClass("d-none");
        $("#icon-mute").removeClass("d-none");

        RemoveAudioVideoSenders(_rtpAudioSenders);
      }
      _isAudioMute = !_isAudioMute;

      console.log("Audio Track available");
    });
    $("#btnStartStopCam").on("click", async function () {
      if (_videoState == VideoStates.Camera) {
        //Stop case
        await ManageVideo(VideoStates.None);
      } else {
        await ManageVideo(VideoStates.Camera);
      }
    });
    $("#btnStartStopScreenshare").on("click", async function () {
      if (_videoState == VideoStates.ScreenShare) {
        //Stop case
        await ManageVideo(VideoStates.None);
      } else {
        await ManageVideo(VideoStates.ScreenShare);
      }
    });

    $("#btnFillCamera").on("click", async function () {
      front = !front;
      await ManageVideo(VideoStates.Camera);
    });
  }
  //Camera or Screen Share or None
  async function ManageVideo(_newVideoState) {
    if (_newVideoState == VideoStates.None) {
      $("#btnStartStopCam_text").text("Start Camera");
      $("#icon-start").removeClass("d-none");
      $("#icon-stop").addClass("d-none");
      $("#btnStartStopScreenshare").text("Screen Share");
      _videoState = _newVideoState;

      ClearCurrentVideoCamStream(_rtpVideoSenders);
      return;
    }

    try {
      var vstream = null;

      if (_newVideoState == VideoStates.Camera) {
        let videoConstrain = {
          width: 720,
          height: 480,
        };
        if (navigator.mediaDevices.getSupportedConstraints().facingMode) {
          console.log("->>>>>>>>both");
          videoConstrain.facingMode = front ? "user" : "environment";
        } else {
          console.log("->>>>>front only");
          videoConstrain.facingMode = "user";
        }

        vstream = await navigator.mediaDevices.getUserMedia({
          video: videoConstrain,
          audio: false,
        });
      } else if (_newVideoState == VideoStates.ScreenShare) {
        vstream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: 720,
            height: 480,
            facingMode: front ? "user" : "environment",
          },
          audio: false,
        });

        vstream.oninactive = (e) => {
          ClearCurrentVideoCamStream(_rtpVideoSenders);
          $("#btnStartStopScreenshare").text("Screen Share");
        };
      }

      ClearCurrentVideoCamStream(_rtpVideoSenders);

      _videoState = _newVideoState;

      if (_newVideoState == VideoStates.Camera) {
        $("#btnStartStopCam_text").text("Stop Camera");
        $("#icon-start").addClass("d-none");
        $("#icon-stop").removeClass("d-none");

        $("#btnStartStopScreenshare").text("Screen Share");
      } else if (_newVideoState == VideoStates.ScreenShare) {
        $("#btnStartStopCam_text").text("Start Camera");
        $("#icon-start").removeClass("d-none");
        $("#icon-stop").addClass("d-none");
        $("#btnStartStopScreenshare").text("Stop Screen Share");
      }

      if (vstream && vstream.getVideoTracks().length > 0) {
        _videoCamSSTrack = vstream.getVideoTracks()[0];

        if (_videoCamSSTrack) {
          _localVideoPlayer.srcObject = new MediaStream([_videoCamSSTrack]);

          AddUpdateAudioVideoSenders(_videoCamSSTrack, _rtpVideoSenders);
        }
      }
    } catch (e) {
      console.log(e);
      return;
    }
  }

  function ClearCurrentVideoCamStream(rtpVideoSenders) {
    if (_videoCamSSTrack) {
      _videoCamSSTrack.stop();
      _videoCamSSTrack = null;
      _localVideoPlayer.srcObject = null;

      RemoveAudioVideoSenders(rtpVideoSenders);
    }
  }

  async function RemoveAudioVideoSenders(rtpSenders) {
    for (var con_id in peers_con_ids) {
      if (rtpSenders[con_id] && IsConnectionAvailable(peers_conns[con_id])) {
        peers_conns[con_id].removeTrack(rtpSenders[con_id]);
        rtpSenders[con_id] = null;
      }
    }
  }

  async function AddUpdateAudioVideoSenders(track, rtpSenders) {
    for (var con_id in peers_con_ids) {
      if (IsConnectionAvailable(peers_conns[con_id])) {
        if (rtpSenders[con_id] && rtpSenders[con_id].track) {
          rtpSenders[con_id].replaceTrack(track);
        } else {
          rtpSenders[con_id] = peers_conns[con_id].addTrack(track);
        }
      }
    }
  }

  async function startwithAudio() {
    try {
      var astream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true,
      });
      _audioTrack = astream.getAudioTracks()[0];

      _audioTrack.onmute = function (e) {
        console.log(e);
      };
      _audioTrack.onunmute = function (e) {
        console.log(e);
      };

      _audioTrack.enabled = false;
    } catch (err) {
      console.log("start audio problem");
      console.log(err.name + ": " + err.message);
      return;
    }
  }

  async function createConnection(connid) {
    var connection = new RTCPeerConnection(iceConfiguration);

    connection.onicecandidate = function (event) {
      console.log(
        "Local ICE agent Send SDP Candidate Details  Through Signalling Server",
      );
      console.table(event.candidate);

      if (event.candidate) {
        // 1st parameter is data and 2nd parameter is send to this  connection id
        _serverFn(JSON.stringify({ iceCandidate: event.candidate }), connid);
      }
    };
    connection.onicecandidateerror = function (event) {
      console.log("ICE Candidate Error");
      console.table(event);

      if (event.errorCode >= 300 && event.errorCode <= 699) {
        let errorData = {
          block: "onicecandidateerror",
          message: "STUN errors are in the range 300-699.",
        };
        _serverErrorReport(errorData);
      } else if (event.errorCode >= 700 && event.errorCode <= 799) {
        let errorData = {
          block: "onicecandidateerror",
          message:
            "Server could not be reached; a specific error number is provided but these are not yet specified.",
        };
        _serverErrorReport(errorData);
      }
    };

    connection.onicegatheringstatechange = function (event) {
      let connection = event.target;
      switch (connection.iceGatheringState) {
        case "gathering":
          console.log("ICE Gathering State Change To gathering state");
          /* collection of candidates has begun */
          break;
        case "complete":
          console.log("ICE Gathering State Change To Complete state");
          /* collection of candidates is finished */
          break;
      }
    };
    connection.onnegotiationneeded = async function (event) {
      console.log("Create New Offer ");
      try {
        await _createOffer(connid);
      } catch (e) {
        let errorObject = {
          block: "on negotiation needed",
          message: e.message,
        };
        _serverErrorReport(errorObject);
        console.log("Failed To Gather compatible matches To connected peers");
      }
    };
    connection.onconnectionstatechange = function (event) {
      console.log(
        "onconnectionstatechange",
        event.currentTarget.connectionState,
      );
      let errorObject;
      switch (event.currentTarget.connectionState) {
        case "failed":
          errorObject = {
            block: "ICE Grathering State Change",
            message:
              "checked all candidates pairs against one another and has failed to find compatible matches for all components of the connection.",
          };
          _serverErrorReport(errorObject);
          console.log("Failed To Gather compatible matches To connected peers");
          break;
        case "disconnected":
          errorObject = {
            block: "ICE Grathering State Change",
            message:
              "on less reliable networks,or during temporary disconnections.When the problem resolves, the connection may return to the connected state.",
          };
          _serverErrorReport(errorObject);
          console.log(
            "less reliable networks,or during temporary disconnections.connection may return to the connected state",
          );
          break;
      }
    };
    // New remote media stream was added
    connection.ontrack = function (event) {
      if (!_remoteVideoStreams[connid]) {
        _remoteVideoStreams[connid] = new MediaStream();
      }

      if (!_remoteAudioStreams[connid])
        _remoteAudioStreams[connid] = new MediaStream();

      if (event.track.kind == "video") {
        _remoteVideoStreams[connid]
          .getVideoTracks()
          .forEach((t) => _remoteVideoStreams[connid].removeTrack(t));
        _remoteVideoStreams[connid].addTrack(event.track);

        var _remoteVideoPlayer = document.getElementById("v_" + connid);

        _remoteVideoPlayer.srcObject = null;
        _remoteVideoPlayer.srcObject = _remoteVideoStreams[connid];
        _remoteVideoPlayer.load();
      } else if (event.track.kind == "audio") {
        var _remoteAudioPlayer = document.getElementById("a_" + connid);
        _remoteAudioStreams[connid]
          .getAudioTracks()
          .forEach((t) => _remoteAudioStreams[connid].removeTrack(t));

        _remoteAudioStreams[connid].addTrack(event.track);

        _audioTrackRemote = _remoteAudioStreams[connid].getAudioTracks()[0];
        _audioTrackRemote.onmute = function (e) {
          $("#remote_audio_status_" + connid).empty();
          $("#remote_audio_status_" + connid).append("mute");
        };
        _audioTrackRemote.onunmute = function (e) {
          $("#remote_audio_status_" + connid).empty();
          $("#remote_audio_status_" + connid).append("Unmute");
        };

        var audioCtx = new AudioContext();
        var source = audioCtx.createMediaStreamSource(
          _remoteAudioStreams[connid],
        );
        var biquadFilter = audioCtx.createBiquadFilter();
        biquadFilter.type = "lowshelf";
        biquadFilter.frequency.value = 1000;
        source.connect(biquadFilter);
        biquadFilter.connect(audioCtx.destination);

        _remoteAudioPlayer.srcObject = null;
        _remoteAudioPlayer.srcObject = _remoteAudioStreams[connid];
        _remoteAudioPlayer.load();
      }
    };

    peers_con_ids[connid] = connid;
    peers_conns[connid] = connection;

    if (
      _videoState == VideoStates.Camera ||
      _videoState == VideoStates.ScreenShare
    ) {
      if (_videoCamSSTrack) {
        AddUpdateAudioVideoSenders(_videoCamSSTrack, _rtpVideoSenders);
      }
    }

    return connection;
  }

  async function _createOffer(connid) {
    //await createConnection();
    var connection = peers_conns[connid];
    console.log("connection.signalingState:" + connection.signalingState);
    var offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    //Send offer to Server
    _serverFn(JSON.stringify({ offer: connection.localDescription }), connid);
  }
  async function exchangeSDP(message, from_connid) {
    message = JSON.parse(message);

    if (message.answer) {
      console.log("answer", message.answer);
      await peers_conns[from_connid].setRemoteDescription(
        new RTCSessionDescription(message.answer),
      );
      console.log("exchange sdp connection answer ", peers_conns[from_connid]);
    } else if (message.offer) {
      console.log("exchange sdp offer", message.offer);

      if (!peers_conns[from_connid]) {
        await createConnection(from_connid);
      }

      await peers_conns[from_connid].setRemoteDescription(
        new RTCSessionDescription(message.offer),
      );
      var answer = await peers_conns[from_connid].createAnswer();
      await peers_conns[from_connid].setLocalDescription(answer);
      _serverFn(JSON.stringify({ answer: answer }), from_connid, _my_connid);
    } else if (message.iceCandidate) {
      console.log("exchange sdp -> iceCandidate", message.iceCandidate);
      if (!peers_conns[from_connid]) {
        await createConnection(from_connid);
      }

      try {
        await peers_conns[from_connid].addIceCandidate(message.iceCandidate);
      } catch (e) {
        console.log("exchange sdp error : ", e);
      }
    }
  }

  function IsConnectionAvailable(connection) {
    if (
      connection &&
      (connection.connectionState == "new" ||
        connection.connectionState == "connecting" ||
        connection.connectionState == "connected")
    ) {
      return true;
    } else return false;
  }
  function closeConnection(connid) {
    peers_con_ids[connid] = null;

    if (peers_conns[connid]) {
      peers_conns[connid].close();
      peers_conns[connid] = null;
    }
    if (_remoteAudioStreams[connid]) {
      _remoteAudioStreams[connid].getTracks().forEach((t) => {
        if (t.stop) t.stop();
      });
      _remoteAudioStreams[connid] = null;
    }

    if (_remoteVideoStreams[connid]) {
      _remoteVideoStreams[connid].getTracks().forEach((t) => {
        if (t.stop) t.stop();
      });
      _remoteVideoStreams[connid] = null;
    }
  }
  return {
    init: async function (serverFn, serverErrorReport, my_connid) {
      await _init(serverFn, serverErrorReport, my_connid);
    },
    ExecuteClientFn: async function (data, from_connid) {
      await exchangeSDP(data, from_connid);
    },
    createNewConnection: async function (connid) {
      await createConnection(connid);
    },
    closeExistingConnection: function (connid) {
      closeConnection(connid);
    },
  };
})();
