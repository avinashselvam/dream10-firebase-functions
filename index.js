const functions = require('firebase-functions')
const admin = require('firebase-admin')
const https = require('https')

const stocks = require('./stocks')
const { UTCYesterday } = require('./utils')

const serviceKey = require('./servicekey.json')
admin.initializeApp({
    credential: admin.credential.cert(serviceKey),
    databaseURL: "https://dream10-d18b3.firebaseio.com"
  })

const db = admin.firestore()
const userCollection = db.collection(UTCYesterday())
const userDetailsCollection = db.collection("users")
const leaderboardCollection = db.collection("leaderboard")
const openingPricesDoc = db.collection("stocks").doc("openingPrices")
const top10Doc = leaderboardCollection.doc("top10")

// const listOfStocks = stocks.stocks
const listOfStocks = ["AAPL"]
const stocksSeparatedByCommas = listOfStocks.join(",")

const apiPrefix = "https://api.twelvedata.com/"
const query = "price?symbol="
const apikeyQuery = "&apikey="
const apikey = "c2a835a8885545829dcaf36ed64db9ec"

const endpoint = apiPrefix + query + stocksSeparatedByCommas + apikeyQuery + apikey

const fetchPrices = (callback) => {
    https.get(endpoint, (resp) => {
        let data = ''
        resp.on('data', (chunk) => {
            data+=chunk
        })
        resp.on('end', () => {
            console.log(data)
        })
    }).on('error', (err) => console.log(err))
}

const updateOpeningPrices = (prices) => {
    openingPricesDoc.set(prices)
}

const updateScoreAndLeaderboard = async (prices) => {
    const openingPrices = await openingPricesDoc.get()

    let percentChange = {}
    for (const stock of listOfStocks) {
        const op = openingPrices[stock]
        const cp = prices[stock]
        percentChange[stock] = (cp-op)/op
    }

    let allScores = [] // used for rank calculation

    let users = await userCollection.get()

    users.forEach((userDoc) => {
        const uid = userDoc.id
        const userStocks = userDoc.data()
        let userScore = {
            percentChange: {}
        }
        let score = 0
        for (const stock in userStocks) {

            userScore.percentChange[stock] = percentChange[stock]

            const weight = userStocks[stock].weight
            const decision = userStocks[stock].decision
            const multiplier = (decision ? 1 : -1)
            score +=  multiplier*weight*percentChange[stock]
        }
        
        allScores.push({score, uid, userScore})
    })

    allScores.sort((a, b) => -(a[0] - b[0]))

    allScores.forEach((user, key) => {
        const uid = user.uid
        let userScore = user.userScore
        userScore.rank = key
       leaderboardCollection.doc(uid).set(userScore)
    })

    const top10 = await top10FromAllScores(allScores)
    top10Doc.set(top10)

}

const top10FromAllScores = async (allScores) => {
    let top10 = {}
    let namePromises = []
    for (let i=0; i<Math.min(10, allScores.length); i++) {
        namePromises.push(userDetailsCollection.doc(allScores[i].uid).get())
    }
    const details = await Promise.all(namePromises)
    for (let i=0; i<Math.min(10, allScores.length); i++) {
        top10[i] = {
            name: details[i].name,
            score: allScores[i].score
        }
    }
    return top10
}

exports.setOpeningPrice = functions.pubsub.schedule('30 9 * * *').timeZone('America/New_York').onRun((context) => {
    fetchPrices(updateOpeningPrices)
    return null
})

exports.updateLeaderboard = functions.pubsub.schedule('every 30 minutes').onRun((context) => {
    fetchPrices(updateScoreAndLeaderboard)
    return null
  });