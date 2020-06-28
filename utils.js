exports.UTCYesterday = () => {
    const today = new Date()
    return ((today.getUTCDay()-1)%7).toString()
}

exports.UTCTimeLiesBetween = (h1 = 13, m1 = 30, h2 = 20, m2 = 30) => {
    const now = new Date()
    const h = now.getHours()
    const m = now.getMinutes()
    return(
        (h > h1 || (h === h1 && m > m1)) && ( h < h2 || (h === h2 && m < m2))
    )
}