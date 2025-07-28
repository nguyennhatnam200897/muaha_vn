function practice() {
    return {
        // cấu hình
        maxSen: 20, // Số câu hỏi tối đa để học
        maxPoint: 10, // Số lần cần đúng để coi là thành thạo
        maxSenBeforePractice: 10, // số câu học được trước khi chế độ ôn bắt đầu
        repeatDelay: 0, // Thời gian âm thanh được lặp lại - tính bằng giây
        probabilityOfTrans: -1, // Xác suất bài tập dịch
        maxPointPerAnwser: 3, // Điểm tối đa nhận được khi trả lời đúng - giảm dần khi trả lời sai

        // states
        showSettings: false, // Thêm state popup
        tempSettings: {}, // Lưu tạm thời khi chỉnh sửa
        wavesurfer: null,
        hasplayed: false,
        iswaveplay: false,
        status: 'loading', // 'loading', 'done', 'error'
        progress: [], // [{1:0}, {2:0}, ...]
        current: {}, // {key: xx, value: xx, mode: xxx}
        currentSentence: {},
        ur: '',
        cr: '',
        userInput: '',
        showAnswer: false,
        isCorrect: false,
        havefalse: false,
        isgiveup: false,

        // Khởi tạo
        init() {
            this.loadProgress();
            this.loadSettings(); // Tải cài đặt từ localStorage
            this.createwavesurfer();
        },

        // Tải tiến trình từ localStorage
        loadProgress() {
            const storedList = localStorage.getItem('progress');
            if (storedList) {
                this.progress = JSON.parse(storedList);
            } else {
                this.progress = Array.from({ length: this.maxSen }, (_, i) => ({ [i + 1]: 0 }));
                this.saveProgress();
            }
        },

        // Lưu tiến trình
        saveProgress() {
            localStorage.setItem('progress', JSON.stringify(this.progress));
        },

        // Tải cài đặt từ localStorage
        loadSettings() {
            const savedSettings = localStorage.getItem('appSettings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                this.repeatDelay = settings.repeatDelay ?? 3; // Sử dụng toán tử nullish coalescing
            }
            this.tempSettings = { 
                repeatDelay: this.repeatDelay 
            };
        },

        // Mở popup
        openSettings() {
            this.tempSettings = { repeatDelay: this.repeatDelay };
            this.showSettings = true;
        },

        // Lưu cài đặt
        saveSettings() {
            this.repeatDelay = this.tempSettings.repeatDelay;
            
            localStorage.setItem('appSettings', JSON.stringify({
                repeatDelay: this.repeatDelay
            }));
            
            this.showSettings = false;
        },

        // Tạo waveform
        createwavesurfer() {
            var pause = false;

            this.wavesurfer = WaveSurfer.create({
                container: '#waveform',
                waveColor: 'rgba(183, 183, 183, 1.000)',
                progressColor: '#64AB47',
                cursorColor: '#64AB47',
                barWidth: 2,
                barGap: 2,
                height: 60,
                hideScrollbar: true,
            });
            this.wavesurfer.on('ready', () => {
                this.status='done';
                if (this.hasplayed && this.current.mode == 'listen') {
                    this.wavesurfer.play(0);
                }
            });
            this.wavesurfer.on('play', () => {
                this.iswaveplay = true;
                if (!this.hasplayed) this.hasplayed = true;
                pause = false;
            });

            this.wavesurfer.on('pause', () => {
                this.iswaveplay = false;
                pause = true;
            });
            
            this.wavesurfer.on('finish', () => {
                this.iswaveplay = false;
                this.wavesurfer.seekTo(0);
                pause = false;
                // Chỉ lặp lại nếu repeatDelay > 0
                if (this.repeatDelay > 0 && !pause && this.current.mode == 'listen') {
                    setTimeout(() => {
                        if (!pause) this.wavesurfer.play();
                    }, this.repeatDelay * 1000);
                }
            });

            this.wavesurfer.on('error', (err) => {
                console.error('WaveSurfer error:', err);
                this.status = 'error';
            });

            this.randomSentence();
        },

        // Toggle play/pause
        togglePlay() {
            if (this.wavesurfer) {
                this.wavesurfer.playPause();
            }
        },
        // lựa chọn câu
        randomSentence() {
            // reset trạng thái
            this.resetState();
            // random chế độ học or ôn tập
            const randomType = Math.floor(Math.random() * 100);
            if (randomType > 90 && Number(Object.keys(this.progress[0])[0]) > this.maxSenBeforePractice) {
                // random để lấy câu ôn lại ngẫu nhiên
                console.log('ôn');
                const randomIndex = Math.floor(Math.random() * (Number(Object.keys(this.progress[0])[0]) - 1)) + 1;
                this.current = { key: Number(randomIndex), value: maxPoint};
            } else {
                // random để lấy câu học mới ngẫu nhiên
                console.log('học');
                const randomIndex = Math.floor(Math.random() * this.progress.length);
                this.current = Object.entries(this.progress[randomIndex]).map(([key, value]) => {
                    return { key: Number(key), value: value, point: this.maxPointPerAnwser};
                })[0]; 
            }
            // random chọn mode bài tập
            const randomMode = Math.floor(Math.random() * 100);
            this.current['mode'] = (randomMode < this.probabilityOfTrans) && (this.current.value >= 1) ? 'translate' : 'listen'
            console.log(this.current)
            this.loadSentence();
        },
        // Tải câu
        loadSentence() {
            // tải dữ liệu câu
            fetch(`/data/${this.current.key}.json`)
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(data => {
                this.currentSentence = data;
                return this.wavesurfer.load(`/audio/${this.current.key}.mp3`);
            })
            .catch(error => {
                console.error('Error loading sentence:', error);
                this.status = 'error';
                // Thử tải lại sau 3s
                setTimeout(() => this.loadSentence(), 3000);
            });
        },

        // Reset state khi tải câu mới
        resetState() {
            this.isgiveup = false;
            this.status = 'loading';
            this.userInput = '';
            this.showAnswer = false;
            this.isCorrect = false;
            // this.similarityScore = 0;
            // this.mistakes = [];
        },

        // Xử lý khi submit answer
        submitAnswer() {
            this.userInput = this.userInput.replace(/\n/g, '');
            if (this.repeatDelay == 0 && this.current.mode == 'listen') this.wavesurfer.play(0);
            this.isCorrect ? this.next() : this.check();
        },

        // Kiểm tra câu trả lời
        check() {
            var u = this.userInput.toLowerCase().replace(/[^a-z\s]|_/g, '').replace(/\s+/g, ' ');
            var c = this.currentSentence.en.toLowerCase().replace(/[^a-z\s]|_/g, '').replace(/\s+/g, ' ');
            this.isCorrect = (u.trim() == c.trim())
            if (this.isCorrect) {
                this.updateProgress('plus');
            } else {
                this.current.point = this.current.point > 1 ? this.current.point - 1 : 1;
                this.havefalse = true;
                var ouw = this.userInput.split(' ');
                var ocw = this.currentSentence.en.split(' ');
                ocw = ocw.filter(function(word) {return word.match(/[a-z]/i);});
                ouw = ouw.filter(function(word) {return word.match(/[a-z]/i);});
                var uw = u.split(' ');
                var cw = c.split(' ');
                uw = uw.filter(function(word) {return word.match(/[a-z]/i);});
                cw = cw.filter(function(word) {return word.match(/[a-z]/i);});
                var dp = [];
                for (var i = 0; i < uw.length + 1; i++) {
                    dp.push([]);
                    for (var j = 0; j < cw.length + 1; j++) {
                        dp[i].push(0);
                    }
                }
                for (var i = 0; i < uw.length; i++) {
                    for (var j = 0; j < cw.length; j++) {
                        if (uw[i] === cw[j]) {
                            dp[i+1][j+1] = dp[i][j] + 1;
                        } else {
                            dp[i+1][j+1] = Math.max(dp[i+1][j], dp[i][j+1]);
                        }
                    }
                }
                var ur = [];
                var cr = [];
                for (var x = uw.length, y = cw.length; x != 0 && y != 0;) {
                    if (dp[x][y] === dp[x-1][y]) {
                        ur.unshift("<div class='text-red-500 leading-[20px]'>" + ouw[x-1] + "</div>");
                        x -= 1;
                    } else if (dp[x][y] === dp[x][y-1]) {
                        cr.unshift(ocw[y-1].replace(/./g, "*"));
                        y -= 1;
                    } else {
                        ur.unshift("<div class='text-green-500 leading-[20px]'>" + ouw[x-1] + "</div>");
                        cr.unshift(ocw[y-1]);
                        x -= 1;
                        y -= 1;
                    }
                }
                for (var i = x; i > 0; i--) {
                        ur.unshift("<div class='text-red-500 leading-[20px]'>" + ouw[i-1] + "</div>");
                }
                for (var i = y; i > 0; i--) {
                    cr.unshift(ocw[i-1].replace(/./g, "*"));
                }
                this.ur=ur.join(" ");
                this.cr=cr.join(" ");
            }
            this.showAnswer = true;
        },
        next() {
            this.wavesurfer.destroy();
            this.createwavesurfer();
        },
        updateProgress(type) {
            // chạy âm thanh nếu mode là translate
            if (this.current.mode == 'translate') this.wavesurfer.play(0);
            // update tiến trình
            if (type == 'plus') {
                console.log(this.current.point);
                this.current['value'] += this.current.point;
                this.progress.forEach(item => {if (item.hasOwnProperty(this.current.key)) { item[this.current.key] += this.current.point}});
                // update tiến trình
                const maxKey = Math.max(...this.progress.map(item => parseInt(Object.keys(item)[0])));
                const len = this.progress.length
                this.progress = this.progress.filter(item => {
                    const value = Object.values(item)[0];
                    return value <= this.maxPoint;
                });
                if (len > this.progress.length) {
                    const newcau = { [maxKey + 1]: 0 };
                    this.progress.push(newcau);
                }
            } else if (type == 'giveup') {
                this.progress.forEach(item => {if (item.hasOwnProperty(this.current.key)) { item[this.current.key] = 0;}});
            }
            // lưu lại tiến trình
            this.saveProgress();
        },

        // bỏ cuộc
        giveup() {
            if (this.current.mode == 'listen') this.updateProgress('giveup');
            this.isgiveup = true;
            this.isCorrect = true;
            this.showAnswer = true;
            // chạy âm thanh nếu mode là translate
            if (this.current.mode == 'translate') this.wavesurfer.play(0);
        },
        // Hiển thị tiêu đề tùy chế độ
        getTitle(type) {
            if (type == 'placeholder') {
                return this.current.mode === 'listen' ? "Họ đang nói gì?..." : "Câu tiếng Anh...";
            } else if (type == 'ask') {
                return this.current.mode === 'listen' ? "Hãy lắng nghe" : "Dịch câu này";
            }
        },
    }
}