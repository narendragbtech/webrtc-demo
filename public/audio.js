


    const socket = io('/');
    let user_id=0;
    let roomID = '';
    let _mediaStream; 
    let _audioTrack;
    let _videoTrack = null;
    let _mediaRecorder;
    let _recordedchunks = [];

    let _remoteStream = new MediaStream();

    let _localVideo;
    let connection =null;
    let _rtpSender;

    const iceConfiguration = {
        iceServers: [
            {urls:'stun:stun.l.google.com:19302'},
            {urls:'stun:stun1.l.google.com:19302'},
            {urls:'stun:stun2.l.google.com:19302'},
            {urls:'stun:stun3.l.google.com:19302'},
            {urls:'stun:stun4.l.google.com:19302'},
          ]
        };

    const socketOperation = ()=>{

        socket.on('open_connection',(user_value)=>{
            user_id=user_value;
            console.log('User ID : ',user_id);
        });

        socket.on('sendToPeer',(message)=>{
            connectionOptions(message);
        })

    };




    let btnStartRecord = document.getElementById('btnStartReco');
    let btnPauseReco = document.getElementById('btnPauseReco');
    let btnResumeReco = document.getElementById('btnResumeReco');
    let btnStopReco = document.getElementById('btnStopReco');
    let downloadRecording = document.getElementById('downloadRecording');
    let btnMuteUnmute = document.getElementById('btnMuteUnmute');
    let btnStartStopcam  = document.getElementById('btnStartStopCam');
    let btnstartConnection = document.getElementById('startConnection');


    const audioSetup =()=>{
        navigator.mediaDevices.getUserMedia({
            video:false, audio:true
        }).then(mediaStream=>{
            _mediaStream = mediaStream;

           // document.getElementById('audioCtr').srcObject = _mediaStream;

            _audioTrack = _mediaStream.getAudioTracks()[0];

            _audioTrack.onmute = function (e){
                console.log('On Mute event : ',e);
            };

            _audioTrack.onunmute = function(e){
                console.log(" On Unmute event : ",e);
            };
            _mediaStream.getAudioTracks().forEach(track =>{
                console.log("Audio Track Data : ",track);
            });

            
        }).catch(error=>{
            console.log("Error While init",error);
        })
    };

    const eventBinding = ()=>{
       
        _localVideo = document.getElementById('videoCtr');

        btnMuteUnmute.addEventListener("click",()=>{

            if(!_audioTrack) return;

            if(!_audioTrack.enabled){
                _audioTrack.enabled = ture;
                btnMuteUnmute.innerText = "Mute";
            }else{
                _audioTrack.enabled = false;
                btnMuteUnmute.innerText = "Unmute";
            }

            console.log("Button Mute _audioTrack Value : ",_audioTrack);
        });

        btnStartRecord.addEventListener("click",()=>{

            setupMediRecorder();
            _mediaRecorder.start(1000);

        });

        btnPauseReco.addEventListener("click",()=>{
            _mediaRecorder.pause();
        });
       
        btnResumeReco.addEventListener("click",()=>{
            _mediaRecorder.resume();
        });

        btnStopReco.addEventListener("click",()=>{
            _mediaRecorder.stop();
        });

        btnStartStopcam.addEventListener("click",()=>{

            if(_videoTrack){
                _videoTrack.stop();
                _videoTrack = null;
                document.getElementById('videoCtr').srcObject = null;
                btnStartStopcam.innerText = 'Start Camera';

                if(_rtpSender && connection){
                    connection.removeTrack(_rtpSender);
                }

                return ;
            }

            navigator.mediaDevices.getUserMedia(
                {
                    video:{
                        width:200,
                        height:200
                    },
                    audio:true
                }).then(videoStram=>{
                if(videoStram && videoStram.getVideoTracks().length > 0){
                    _videoTrack = videoStram.getVideoTracks()[0];
                    setLocalVideo(true);
                    document.getElementById('videoCtr').srcObject = new MediaStream([_videoTrack]); 
                    btnStartStopcam.innerText = 'Stop Camera';
                }
            }).catch(error=>{
                console.log(error);
                return;
            })
        });

        btnstartConnection.addEventListener("click",()=>{
            let roomValue = document.getElementById('roomName').value;
           if(roomValue !==undefined){
               roomID = roomValue;
                socket.emit('join_room',roomValue,user_id);
                audioSetup();
                createconnection().then(r=>{}).catch(error=>{console.log(error)});
           }
            
        })
    };

    const setLocalVideo =  (isVideo)=>{

        let currentTrack;
        if(isVideo){
            if(_videoTrack){
                _localVideo.srcObject = new MediaStream([_videoTrack]);
                currentTrack = _videoTrack;
            }
        }else{
            if(_videoTrack){
                btnStartStopcam.click();
            }
        }

        if(_rtpSender && _rtpSender.track && currentTrack && connection){
            _rtpSender.replaceTrack(currentTrack);
        }else{
            if(currentTrack && connection)
                _rtpSender = connection.addTrack(currentTrack);
        }
    };

    const setupMediRecorder = ()=>{

        let _width = 0;
        let _height = 0;

        if(_videoTrack){
            _width = _videoTrack.getSetttings().width;
            _height = _videoTrack.getSetttings().height;
        }

        let merger = new VideoStreamMerger({
            width:_width,
            height:_height,
            fps:1,
            audiocontext:null
        })

        if(_videoTrack && _videoTrack.readyState === "live"){
            merger.addStream(new MediaStream([_videoTrack]),{
                x:0,
                y:0,
                width:_width,
                height:_height,
                mute:true
            })
        }

        if(_audioTrack && _audioTrack.readyState ==="live"){
            merger.addStream(new MediaStream([_audioTrack]),{
                mute:false
            });
        }

        merger.start();
        
    

        // var stream = new MediaStream([_audioTrack]);

        let stream = merger.result;
        let videoRecPlayer = document.getElementById('VideoCtrRec');
        videoRecPlayer.srcObject = stream;
        videoRecPlayer.load();
        videoRecPlayer.style.display = 'block';

        // if(_videoTrack && _videoTrack.readyState === "live"){
        //     stream.addTrack(_videoTrack);
        // }

        stream.getTracks().forEach(track =>{
                console.log(track);
        });

        _recordedchunks = [];

        _mediaRecorder = new MediaRecorder(_mediaStream,{
            mimeType:'video/webm; codecs=vp8,opus'
        });

        _mediaRecorder.ondataavailable = (e)=>{
            console.log('Size of Data : ',e.data.size);
            if(e.data.size > 0)
                _recordedchunks.push(e.data);
        }

        _mediaRecorder.onstart = ()=>{

            btnStartRecord.style.display = 'none';
            btnPauseReco.style.display = 'block';
            btnStopReco.style.display = 'block';
            downloadRecording.style.display = 'none';
        }

        _mediaRecorder.onpause = ()=>{
            btnPauseReco.style.display = 'none';
            btnResumeReco.style.display = 'block';
        }

        _mediaRecorder.onresume = ()=>{
            btnPauseReco.style.display = 'block';
            btnResumeReco.style.display = 'none';
            btnStopReco.style.display = 'block';
        }

        _mediaRecorder.onstop = ()=>{
            downloadFile();
            btnPauseReco.style.display = 'none';
            btnPauseReco.style.display = 'block';
            btnStopReco.style.display = 'none';
        }

    };

    const downloadFile=()=>{
        let blob = new Blob(_recordedchunks,{type:'video/webm'});

        let url = window.URL.createObjectURL(blob);

        downloadRecording.setAttribute('href',url);
        downloadRecording.setAttribute('download','test.weba');
        downloadRecording.style.display='block';

        let videoRecPlayer = document.getElementById('VideoCtrRec');
        videoRecPlayer.srcObject = null;
        videoRecPlayer.load();
        videoRecPlayer.src = url;
        videoRecPlayer.play();
        videoRecPlayer.style.display = 'block';

    };

    const connectionOptions = (message)=>{

        message = JSON.parse(message);

        if(message.rejected){
            alert("Other user rejected");
        }else if(message.answer){
            console.log("answer",message.answer);
            connection.setRemoteDescription(new RTCSessionDescription(message.answer));
        }else if(message.offer){
            console.log('offer',message.offer);

            let r =true;

            if(!_audioTrack){

                r=confirm('went to contnue?');
                if(r){
                    audioSetup();
                }else{
                // send socket ot reject 
                let rejectJson =JSON.stringify({'rejected':'true'});
                if(!roomID!=='')
                    socket.emit('sendToPeer',roomID,rejectJson);
                }
            }else{
                if(!connection){
                    createconnection().then(r=>{
                        connection.setRemoteDescription(new RTCSessionDescription(message.offer));
                        connection.createAnswer().then(answer=>{
                                connection.setLocalDescription(answer).then(r=>{
                                    // send socket to answer
                                    let answerString = JSON.stringify({'answer':answer});
                                    if(!roomID!=='')
                                    socket.emit('sendToPeer',roomID,answerString);
                                
                                });
                        });
                    });
                }else{
                    connection.setRemoteDescription(new RTCSessionDescription(message.offer));
                    connection.createAnswer().then(answer=>{
                            connection.setLocalDescription(answer).then(r=>{
                                // send socket to answer
                                let answerString = JSON.stringify({'answer':answer});
                                if(!roomID!=='')
                                    socket.emit('sendToPeer',roomID,answerString);
                            });
                    });
                }              
            }
        }else if (message.iceCandidate){
            console.log('ice Candidate',message.iceCandidate);
            if(!connection){
                createconnection().then(r=>{
                    connection.addIceCandidate(message.iceCandidate).catch(error=>{
                        console.log(error);
                    });
                })
            }else{
                connection.addIceCandidate(message.iceCandidate).catch(error=>{
                    console.log(error);
                });
            }
        }
    };

    const createconnection = ()=>{
        return new Promise((resolve,reject)=>{

            console.log('create connnection');

            connection = new RTCPeerConnection(iceConfiguration);
            connection.onicecandidate = (event)=>{
                console.log('on ice candidate',event.candidate);
                if(event.candidate){
                    let jsonString = JSON.stringify({'iceCandidate':event.candidate});
                    // send throught socket
                    if(roomID!=='')
                        socket.emit('sendToPeer',roomID,jsonString);
                }                
            }

            connection.onicecandidateerror = (event)=>{
                console.log('onicecandidateerror', event);
            }

            connection.onicegatheringstatechange  = (event)=>{
                console.log('onicegatheringstatechange ', event);
            }

            connection.onnegotiationneeded  = (event)=>{
                console.log('onnegotiationneeded ', event);
                createOffer();
            }

            connection.onconnectionstatechange = function (event) {
                console.log('onconnectionstatechange', connection.connectionState)
                if (connection.connectionState === "connected") {
                   console.log('connected')
                }
            }


            connection.ontrack = (event)=>{

                if(!_remoteStream)
                    _remoteStream = new MediaStream();

                if(event.streams.length > 0){
                    // _remoteStream = event.streams[0];
                }    

                if(event.track.kind == 'video'){

                    _remoteStream.getVideoTracks()
                    .forEach(t=>{
                        _remoteStream.removeTrack(t);
                    });
                }

                _remoteStream.addTrack(event.track);

                _remoteStream.getTracks()
                .forEach(t=>console.log(t));

                let newVideoElement = document.getElementById('remoteVideoCtr');
                newVideoElement.srcObject = null;

                newVideoElement.srcObject = _remoteStream;

                newVideoElement.load();
                // newVideoElement.paly();

            };

            if(_videoTrack){
                _rtpSender = connection.addTrack(_videoTrack);
            }

            if(_audioTrack){
                connection.addTrack(_audioTrack,_remoteStream);
            }

            if(_audioTrack){
                connection.addTrack(_audioTrack);
            }
            resolve(1);

        });
    };

    const createOffer =()=>{

            connection.createOffer().then(offer=>{
                connection.setLocalDescription(offer).then(r=>{
                    console.log('offer',offer);
                    console.log('local description',connection.localDescription);
                    let offerString = JSON.stringify({
                        'offer':connection.localDescription
                    });
                    //send throught socket 
                    if(roomID!==''){
                        socket.emit('sendToPeer',roomID,offerString);
                    }

                })
            });
    };


socketOperation();
eventBinding();
