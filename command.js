const Discord = require('discord.js'),
    client = new Discord.Client(),
    fs = require('fs')

const config = JSON.parse(fs.readFileSync('secrets.json')),
    tictactoe = require('./tictactoe.js'),
    chess = require('./chess.js')

var gameState

client.on('disconnect', event => {
    console.log('!Disconnected: ' + event.reason + ' (' + event.code + ')!')
})

client.on('ready', () => {
    console.log('╦═╗┌─┐┌─┐┌┬┐┬ ┬┬\n╠╦╝├┤ ├─┤ ││└┬┘│\n╩╚═└─┘┴ ┴─┴┘ ┴ o')

    // Cleans master state
    masterStateStore({ 'nextGameID': 0, 'channelsAwaitingPlayer2': {} })

    // Removes any game state files
    fs.readdir('./', function (err, files) {
        if (err) throw err

        for (let i = 0; i < files.length - 1; i++) {
            if (files[i].slice(0, 2) == 'GS') {
                fs.unlink(files[i], err => {
                    if (err) throw err
                })
            }
        }

    })
})

client.on('message', message => {
    if (!message.author.bot) {
        console.log('\n\nMessage detected.')
        console.log('Time: ' + Date())
        console.log(message.author.username + ': ' + message.content)
        console.log('Length: ' + message.content.length)

        var masterState = masterStateParse()

        if (message.content === 'READY' && masterState.channelsAwaitingPlayer2.hasOwnProperty(message.channel.id)) {

            let gameID = masterState.channelsAwaitingPlayer2[message.channel.id]
            gameState = gameStateParse(gameID)

            delete masterState.channelsAwaitingPlayer2[message.channel.id]
            masterState[message.author.id] = gameID
            masterStateStore(masterState)

            console.log('Player 2: ' + message.author.username)
            message.delete()
            messagePurge(gameState.toBeDeleted)
            let channelMembers = message.channel.members
            message.channel.send('Player 1 identified as ' + channelMembers.get(gameState.Player1.id).toString())
            message.channel.send('Player 2 identified as ' + message.author.toString())


            gameState.awaitingPlayer2 = false
            gameState.Player2 = { 'id': message.author.id, 'name': message.author.username }
            gameState.inGame = true

            gameState.turn = 1
            gameState.lastMove = null

            randInt(1, 2)
            let playerTurn = randInt(1, 2)
            gameState.playerTurn = playerTurn
            console.log('Player ' + playerTurn + ' goes first.')

            let gameBoard = []
            for (let i = 0; i < 9; i++) gameBoard.push('-')
            gameState.gameBoard = gameBoard
            console.log('Empty game board generated.')

            gameStateStore(gameID, gameState)

            if (gameState.lastMove != null) {
                messagePurge(gameState.toBeDeleted)
                console.log('Cleaned old board.')
            }

            tictactoe.sendTicTacToeBoard(gameID, message.channel, gameState, masterState, client.user)
        } else if (masterState.hasOwnProperty(message.author.id)) {
            console.log('Player found in Master State...')

            var gameID = masterState[message.author.id],
                gameState = gameStateParse(gameID)

            if (gameState.gameType == 0) {
                if (
                    message.content == 1 || message.content == 2
          && gameState.awaitingPlayerCount
          && message.author.id == gameState.Player1.id
                ) {
                    message.delete()

                    switch (message.content) {

                    case '1': {
                        console.log('1 player mode selected.')
                        messagePurge(gameState.toBeDeleted)
                        gameState.awaitingPlayerCount = false
                        gameState.playerCount = 1
                        gameState.inGame = true

                        let nameList = JSON.parse(fs.readFileSync('names.json', 'utf8')).names,
                            nameID = randInt(0, nameList.length - 1)
                        gameState.Player2 = { 'id': null, 'name': nameList[nameID] }

                        gameState.turn = 1
                        gameState.lastMove = null

                        randInt(1, 2) // First time randInt is called, it always returns 2
                        let playerTurn = randInt(1, 2)
                        gameState.playerTurn = playerTurn
                        console.log('Player ' + playerTurn + ' goes first.')

                        switch (gameState.gameType) {
                        case 0: {
                            let gameBoard = []
                            for (let i = 0; i < 9; i++) gameBoard.push('-')
                            gameState.gameBoard = gameBoard
                            console.log('Empty game board generated.')
                            break
                        }

                        case 1:
                            // TODO: Generate chess board
                            break
                        }

                        if (playerTurn == 2) {  // AI goes first

                            let playerMove = tictactoe.botMove(gameState.gameBoard)
                            gameState.gameBoard[playerMove] = 'o'
                            gameState.turn++
                            gameState.playerTurn = 1
                            gameState.lastMove = playerMove

                        } else messagePurge(gameState.toBeDeleted)

                        gameStateStore(gameID, gameState)

                        tictactoe.sendTicTacToeBoard(gameID, message.channel, gameState, masterState, client.user)
                        break
                    }

                    case '2': {
                        console.log('2 player mode selected.')
                        messagePurge(gameState.toBeDeleted)
                        gameState.awaitingPlayerCount = false
                        gameState.playerCount = 2
                        gameState.awaitingPlayer2 = true

                        masterState.channelsAwaitingPlayer2[message.channel.id] = gameID
                        masterStateStore(masterState)

                        gameStateStore(gameID, gameState)
                        message.channel.send('Player 2, please say "READY".').then( msg => {
                            markForPurge(gameID, msg)
                        })
                        break
                    }

                    default:
                        message.channel.send({embed: {
                            color: 0xff0000,
                            author: {
                                name: client.user.username,
                                icon_url: 'https://getadblock.com/images/adblock_logo_stripe_test.png'
                            },
                            title: 'Error Handler',
                            url: 'https://github.com/LEARAX/Tactic',
                            fields: [{
                                name: 'INVALID NUMBER OF PLAYER',
                                value: 'Unrecognized value "' + message.content + '". Please enter "1" or "2".'
                            }],
                        }
                        })
                    }
                }
            }


            if (message.content.slice(0, 2) == '*$') {
                message.delete()

                console.log('Command detected.')
                const commandInput = message.content.slice(2)
                console.log('Command: ' + commandInput)

                console.log('Parsing initial game state...')
                gameState = gameStateParse(gameID)

                if (gameState.gameType == 0 && gameState.inGame) {
                    if (gameState.playerCount == 2) {
                        console.log('We\'re ingame, with 2 players. Begin parsing move.')

                        switch (gameState.playerTurn) {
                        case 1:
                            if (message.author.id == gameState.Player1.id) {

                                try {
                                    var playerMove = parseInt(commandInput) - 1
                                } catch (err) {
                                    console.log('Error encountered parsing move: ') + err
                                }

                                if (gameState.gameBoard[playerMove] == '-') {
                                    gameState.gameBoard[playerMove] = 'x'
                                    gameState.turn++
                                    gameState.playerTurn = 2
                                    gameState.lastMove = playerMove
                                    gameStateStore(gameID, gameState)

                                    if (gameState.lastMove != null) {
                                        messagePurge(gameState.toBeDeleted)
                                        console.log('Cleaned old board.')
                                    }

                                    tictactoe.sendTicTacToeBoard(gameID, message.channel, gameState, masterState, client.user)
                                } else {
                                    if (playerMove == 'NaN') {
                                        message.channel.send('Invalid move: ' + (playerMove + 1))
                                    } else {
                                        message.channel.send('Invalid move: ' + commandInput)
                                    }
                                }
                            }
                            break

                        case 2:
                            if (message.author.id == gameState.Player2.id) {

                                try {
                                    playerMove = parseInt(commandInput) - 1
                                } catch (err) {
                                    console.log('Error encountered parsing move: ') + err
                                }

                                if (gameState.gameBoard[playerMove] == '-') {
                                    gameState.gameBoard[playerMove] = 'o'
                                    gameState.turn++
                                    gameState.playerTurn = 1
                                    gameState.lastMove = playerMove
                                    gameStateStore(gameID, gameState)

                                    if (gameState.lastMove != null) {
                                        messagePurge(gameState.toBeDeleted)
                                        console.log('Cleaned old board.')
                                    }

                                    tictactoe.sendTicTacToeBoard(gameID, message.channel, gameState, masterState, client.user)
                                } else {
                                    if (playerMove == 'NaN') {
                                        message.channel.send('Invalid move: ' + (playerMove + 1))
                                    } else {
                                        message.channel.send('Invalid move: ' + commandInput)
                                    }
                                }
                            }
                            break
                        }
                    } else if (gameState.playerCount == 1) {
                        console.log('We\'re ingame, with 1 player. Begin parsing move.')
                        if (gameState.playerTurn == 1) {
                            if (message.author.id == gameState.Player1.id) {

                                try {
                                    playerMove = parseInt(commandInput) - 1
                                } catch (err) {
                                    console.log('Error encountered parsing move: ' + err)
                                }

                                if (gameState.gameBoard[playerMove] == '-') {
                                    gameState.gameBoard[playerMove] = 'x'
                                    gameState.turn++
                                    gameState.playerTurn = 2
                                    gameState.lastMove = playerMove

                                    console.log('Win status: ' + tictactoe.checkWin(gameState.lastMove, gameState.gameBoard))
                                    if (tictactoe.checkWin(gameState.lastMove, gameState.gameBoard)) {

                                        if (gameState.lastMove != null) {
                                            messagePurge(gameState.toBeDeleted)
                                            console.log('Cleaned old board.')
                                        }

                                        tictactoe.sendTicTacToeBoard(gameID, message.channel, gameState, masterState, client.user)
                                        var gameOver = true
                                    } else if (gameState.gameBoard.indexOf('-') == -1) {


                                        if (gameState.lastMove != null) {
                                            messagePurge(gameState.toBeDeleted)
                                            console.log('Cleaned old board.')
                                        }

                                        tictactoe.sendTicTacToeBoard(gameID, message.channel, gameState, masterState, client.user)
                                        gameOver = true
                                    }

                                    if (!gameOver) {
                                        console.log('Game not ended, starting AI procedure...')

                                        // Begin AI response
                                        playerMove = tictactoe.botMove(gameState.gameBoard)

                                        gameState.gameBoard[playerMove] = 'o'
                                        gameState.turn++
                                        gameState.playerTurn = 1
                                        gameState.lastMove = playerMove
                                        console.log('II Win status: ' + tictactoe.checkWin(gameState.lastMove, gameState.gameBoard))
                                        gameStateStore(gameID, gameState)

                                        if (gameState.lastMove != null) {
                                            messagePurge(gameState.toBeDeleted)
                                            console.log('Cleaned old board.')
                                        }

                                        tictactoe.sendTicTacToeBoard(gameID, message.channel, gameState, masterState, client.user)
                                    }
                                } else {
                                    if (playerMove == 'NaN') {
                                        message.channel.send('Invalid move: ' + (playerMove + 1))
                                    } else {
                                        message.channel.send('Invalid move: ' + commandInput)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } else if (message.content.slice(0, 2) == '*$') {
            message.delete()

            console.log('Command detected.')
            const commandInput = message.content.slice(2),
                commandInputSplit = commandInput.split(' ')
            console.log('Command: ' + commandInput)

            switch (commandInputSplit[0]) {
            case 'ls':
            case 'list':
                message.channel.send({embed: {
                    color: 0x0000ff,
                    author: {
                        name: client.user.username,
                        icon_url: client.user.avatarURL
                    },
                    title: 'File System Wizard',
                    url: 'https://github.com/LEARAX/Tactic',
                    fields: [

                        {
                            name: '```[0]: Tic-Tac-Toe```',
                            value: 'X\'s & O\'s'
                        },
                        {
                            name: '```[1]: Chess```',
                            value: 'Knights in shining armor'
                        }
                    ],
                }
                })
                break

            case 'run':
                switch (commandInputSplit[1]) {

                case '0':
                    console.log('Player ' + message.author.username + ' has selected Tic-Tac-Toe...')

                    masterState[message.author.id] = masterState.nextGameID
                    masterState.nextGameID++
                    masterStateStore(masterState)

                    gameState = {
                        'gameType': 0,
                        'Player1': { 'id': message.author.id, 'name': message.author.username },
                        'awaitingPlayerCount': true
                    }

                    gameStateStore(masterState[message.author.id], gameState)

                    message.reply('1 or 2 players?').then( msg => markForPurge(masterState[message.author.id], msg))
                    break

                case '1':
                    console.log('Player ' + message.author.username + ' has selected Chess...')

                    masterState[message.author.id] = masterState.nextGameID
                    masterState.nextGameID++
                    masterStateStore(masterState)

                    gameState = {
                        'gameType': 1,
                        'Player1': { 'id': message.author.id, 'name': message.author.username },
                        'awaitingPlayerCount': true
                    }

                    gameStateStore(masterState[message.author.id], gameState)

                    message.reply('1 or 2 players?').then( msg => markForPurge(masterState[message.author.id], msg))
                    break

                default:
                    message.channel.send({embed: {
                        color: 0xff0000,
                        author: {
                            name: client.user.username,
                            icon_url: 'https://getadblock.com/images/adblock_logo_stripe_test.png'
                        },
                        title: 'Error Handler',
                        url: 'https://github.com/LEARAX/Tactic',
                        fields: [{
                            name: 'UNRECOGNIZED PROGRAM',
                            value: 'Program ID "' + commandInputSplit[1] + '" was unrecognized.'
                        }],
                    }
                    })
                }
                break

            case '':
                message.channel.send({embed: {
                    color: 0xff0000,
                    author: {
                        name: client.user.username,
                        icon_url: 'https://getadblock.com/images/adblock_logo_stripe_test.png'
                    },
                    title: 'Error Handler',
                    url: 'https://github.com/LEARAX/Tactic',
                    fields: [{
                        name: 'COMMAND INVALID',
                        value: 'Please enter a command!'
                    }],
                }
                })
                break

            default:
                message.channel.send({embed: {
                    color: 0xff0000,
                    author: {
                        name: client.user.username,
                        icon_url: 'https://getadblock.com/images/adblock_logo_stripe_test.png'
                    },
                    title: 'Error Handler',
                    url: 'https://github.com/LEARAX/Tactic',
                    fields: [{
                        name: 'COMMAND INVALID',
                        value: 'Your command "' + commandInputSplit[0] + '" was unrecognized.'
                    }],
                }
                })
            }
        }
    }
})


function markForPurge (file, msg) {
    gameStateAppend(file, 'toBeDeleted', { 'id': msg.id, 'channel': msg.channel.id, 'guild': msg.guild.id })
}

function gameStateParse (file) {
    console.log(file)
    let gameState = JSON.parse(fs.readFileSync('GS' + file + '.json', 'utf8'))
    console.log('Gamestate parsed.')
    console.log('Gamestate: ' + JSON.stringify(gameState))
    return gameState
}

function gameStateStore (file, gameState) {
    fs.writeFileSync('GS' + file + '.json', JSON.stringify(gameState), 'utf8')  // Write it back
    console.log('Game state stored.')
}

function gameStateAppend (file, name, value) {
    let gameState = gameStateParse(file)

    gameState[name] = value

    gameStateStore(file, gameState)

    console.log('Value ' + JSON.stringify(value) + ' for item ' + name + ' stored to game state ' + file +'.')
}

function masterStateParse () {
    let masterState = JSON.parse(fs.readFileSync('Master State.json', 'utf8'))
    console.log('Master state parsed.')
    console.log('Master state: ' + JSON.stringify(masterState))
    return masterState
}

function masterStateStore (masterState) {
    fs.writeFileSync('Master State.json', JSON.stringify(masterState), 'utf8')  // Write it back
    console.log('Master state stored.')
}

function messagePurge (marked) {
    let messageToBeDeletedGuild = client.guilds.get(marked.guild)
    console.log('Marked message guild: ' + messageToBeDeletedGuild.name)
    let messageToBeDeletedChannel = messageToBeDeletedGuild.channels.get(marked.channel)
    console.log('Marked message channel: ' + messageToBeDeletedChannel.name)
    let messageToBeDeleted = messageToBeDeletedChannel.messages.get(marked.id)
    console.log('Isolated message to be removed.')
    console.log('Message to be deleted: ' + messageToBeDeleted.content)
    messageToBeDeleted.delete()
}

function randInt(min, max) {
    min = Math.ceil(min)
    max = Math.floor(max)
    return Math.floor(Math.random() * (max - min + 1)) + min
}


client.login(config.token)
