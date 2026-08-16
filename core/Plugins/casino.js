const balances = global.crystalBalances =
    global.crystalBalances || new Map();

function getBalance(id) {
    return balances.get(id) || 1000;
}

function setBalance(id, amount) {
    balances.set(id, amount);
}

module.exports = [
    {
        name: 'balance',
        alias: ['bal'],
        description: 'Check casino balance',
        category: 'CASINO',

        async execute({ reply, sender }) {
            await reply(
                `💰 *CRYSTAL BALANCE*\n\n` +
                `Balance: *${getBalance(sender)} CRYSTALS*`
            );
        }
    },

    {
        name: 'daily',
        description: 'Claim daily crystals',
        category: 'CASINO',

        async execute({ reply, sender }) {
            const reward = 500;
            const balance = getBalance(sender);

            setBalance(sender, balance + reward);

            await reply(
                `🎁 *DAILY REWARD*\n\n` +
                `You received: *${reward} CRYSTALS*\n` +
                `Balance: *${balance + reward}*`
            );
        }
    },

    {
        name: 'roulette',
        description: 'Play roulette',
        category: 'CASINO',

        async execute({ reply, sender, args }) {
            const bet = Number(args[0]);

            if (!Number.isInteger(bet) || bet <= 0) {
                return reply('🎰 Usage: /roulette 100');
            }

            const balance = getBalance(sender);

            if (bet > balance) {
                return reply('❌ Insufficient crystals.');
            }

            const win = Math.random() < 0.5;

            const newBalance =
                win
                    ? balance + bet
                    : balance - bet;

            setBalance(sender, newBalance);

            await reply(
                `🎰 *ROULETTE*\n\n` +
                `${win ? '🎉 You won!' : '💀 You lost!'}\n` +
                `Amount: ${bet}\n` +
                `Balance: ${newBalance}`
            );
        }
    },

    {
        name: 'blackjack',
        description: 'Play blackjack',
        category: 'CASINO',

        async execute({ reply }) {
            const player = Math.floor(Math.random() * 10) + 11;
            const dealer = Math.floor(Math.random() * 10) + 11;

            await reply(
                `🃏 *BLACKJACK*\n\n` +
                `You: ${player}\n` +
                `Dealer: ${dealer}\n\n` +
                `${player > dealer ? '🎉 You win!' : player === dealer ? '🤝 Draw!' : '💀 Dealer wins!'}`
            );
        }
    }
];