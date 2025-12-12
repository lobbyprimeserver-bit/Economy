const fs = require('fs');
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
require('dotenv').config();

// Archivo de datos donde se guardan los saldos
const DATA_FILE = './data.json';
let data = { users: {} };

// Cargar datos existentes o crear nuevos
if (fs.existsSync(DATA_FILE)) {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  data = JSON.parse(raw || '{"users":{}}');
} else {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Guardar datos
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Crear usuario si no existe
function ensureUser(userId) {
  if (!data.users[userId]) {
    data.users[userId] = {
      balance: 0,   // dinero en mano
      bank: 0,      // dinero en banco
      lastDaily: 0,
      lastRob: 0,
    };
  } else {
    if (typeof data.users[userId].bank !== 'number') {
      data.users[userId].bank = 0;
    }
    if (typeof data.users[userId].lastDaily !== 'number') {
      data.users[userId].lastDaily = 0;
    }
    if (typeof data.users[userId].lastRob !== 'number') {
      data.users[userId].lastRob = 0;
    }
  }
}

// Formato de dinero tipo $1,000
const money = (n) => `$${new Intl.NumberFormat('en-US').format(n)}`;

// Construir embed de balance
function buildBalanceEmbed(user, userData) {
  const total = userData.balance + userData.bank;

  return new EmbedBuilder()
    .setAuthor({
      name: `Balance de ${user.username}_${user.discriminator}`,
      iconURL: user.displayAvatarURL(),
    })
    .setColor(0x2b2d31)
    .addFields(
      { name: '🪙 Coins', value: money(userData.balance), inline: true },
      { name: '🏛 Banco', value: money(userData.bank), inline: true },
      { name: '📊 Total', value: money(total), inline: false },
    )
    .setFooter({ text: 'Lobby Points • Sistema económico' });
}

// Cliente de Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// 👉 Prefijo oficial del bot: usas !lp bal, !lp daily, etc.
const PREFIX = '!lp';

client.on('ready', () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
  client.user.setActivity('tu banco virtual 🏦');
});

// Manejo de comandos por mensaje
client.on('messageCreate', (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  // Ej: "!lp bal" → slice => " bal" → trim => "bal ..."
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const userId = message.author.id;

  ensureUser(userId);
  const userData = data.users[userId];

  // !lp ping
  if (command === 'ping') {
    message.reply('pong 🏓');
    return;
  }

  // !lp bal / !lp bal @usuario → panel propio o solo ver a otra persona
  if (command === 'bal' || command === 'balance') {
    const mentioned = message.mentions.users.first();

    // Si mencionas a alguien → MOSTRAR SOLO SU BALANCE, sin botones
    if (mentioned) {
      ensureUser(mentioned.id);
      const targetData = data.users[mentioned.id];
      const embed = buildBalanceEmbed(mentioned, targetData);
      message.reply({ embeds: [embed] });
      return;
    }

    // Si no mencionas a nadie → tu panel con botones
    const embed = buildBalanceEmbed(message.author, userData);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`bal:deposit:${userId}`)
        .setLabel('Depositar todo')
        .setEmoji('🏦')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`bal:withdraw:${userId}`)
        .setLabel('Retirar')
        .setEmoji('💸')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`bal:refresh:${userId}`)
        .setLabel('Actualizar')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Secondary),
    );

    message.reply({ embeds: [embed], components: [row] });
    return;
  }

  // !lp daily
  if (command === 'daily') {
    const now = Date.now();
    const DAY = 1000 * 60 * 60 * 24;

    if (now - userData.lastDaily < DAY) {
      message.reply('ya reclamaste tu daily ⏳');
      return;
    }

    const reward = 100;
    userData.balance += reward;
    userData.lastDaily = now;
    saveData();

    message.reply(`reclamaste **${money(reward)}** 💸 (en mano)`);
    return;
  }

  // !lp work
  if (command === 'work') {
    const min = 10;
    const max = 50;
    const earned = Math.floor(Math.random() * (max - min + 1)) + min;

    userData.balance += earned;
    saveData();

    message.reply(`ganaste **${money(earned)}** trabajando 🛠️`);
    return;
  }

  // !lp deposit
  if (command === 'deposit' || command === 'dep') {
    if (args.length === 0) {
      message.reply('usa: `!lp deposit cantidad` o `!lp deposit all`');
      return;
    }

    let amount;
    if (args[0].toLowerCase() === 'all') {
      amount = userData.balance;
    } else {
      amount = parseInt(args[0]);
      if (isNaN(amount) || amount <= 0) {
        message.reply('cantidad inválida 💵');
        return;
      }
    }

    if (userData.balance <= 0) {
      message.reply('no tienes dinero en mano para depositar 😅');
      return;
    }

    if (amount > userData.balance) {
      amount = userData.balance;
    }

    userData.balance -= amount;
    userData.bank += amount;
    saveData();

    message.reply(
      `has depositado **${money(amount)}** en el banco 🏦\n` +
      `🪙 Mano: **${money(userData.balance)}** | 🏛 Banco: **${money(userData.bank)}**`,
    );
    return;
  }

  // !lp withdraw
  if (command === 'withdraw' || command === 'with') {
    if (args.length === 0) {
      message.reply('usa: `!lp withdraw cantidad` o `!lp withdraw all`');
      return;
    }

    let amount;
    if (args[0].toLowerCase() === 'all') {
      amount = userData.bank;
    } else {
      amount = parseInt(args[0]);
      if (isNaN(amount) || amount <= 0) {
        message.reply('cantidad inválida 💵');
        return;
      }
    }

    if (userData.bank <= 0) {
      message.reply('no tienes dinero en el banco para retirar 😅');
      return;
    }

    if (amount > userData.bank) {
      amount = userData.bank;
    }

    userData.bank -= amount;
    userData.balance += amount;
    saveData();

    message.reply(
      `has retirado **${money(amount)}** del banco 💸\n` +
      `🪙 Mano: **${money(userData.balance)}** | 🏛 Banco: **${money(userData.bank)}**`,
    );
    return;
  }

  // !lp pay
  if (command === 'pay') {
    const target = message.mentions.users.first();
    const amountArg = args.find((a) => !isNaN(parseInt(a)));
    const amount = parseInt(amountArg);

    if (!target) {
      message.reply('usa: `!lp pay @usuario cantidad`');
      return;
    }

    if (!amount || amount <= 0) {
      message.reply('cantidad inválida 💵');
      return;
    }

    ensureUser(target.id);
    const targetData = data.users[target.id];

    if (userData.balance < amount) {
      message.reply('no tienes suficiente dinero en mano 😅');
      return;
    }

    userData.balance -= amount;
    targetData.balance += amount;
    saveData();

    message.reply(`le pagaste **${money(amount)}** a ${target.username} ✅`);
    return;
  }

  // !lp rob @usuario → intentar robar SOLO lo que tiene en mano, con cooldown y deuda
  if (command === 'rob') {
    const target = message.mentions.users.first();

    if (!target) {
      message.reply('usa: `!lp rob @usuario`');
      return;
    }

    if (target.id === userId) {
      message.reply('no puedes robarte a ti mism@ 😂');
      return;
    }

    const now = Date.now();
    const COOLDOWN = 1000 * 60 * 60; // 1 hora

    // cooldown por ladrón
    if (now - userData.lastRob < COOLDOWN) {
      const remaining = COOLDOWN - (now - userData.lastRob);
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);

      message.reply(
        `⚠️ Aún no puedes robar. Te faltan **${minutes}m ${seconds}s** para poder usar \`!lp rob\` de nuevo.`
      );
      return;
    }

    ensureUser(target.id);
    const targetData = data.users[target.id];

    // Solo se puede robar si la víctima tiene algo EN MANO (balance)
    if (targetData.balance <= 0) {
      message.reply('ese usuario no tiene nada en mano para robarle 😅');
      return;
    }

    // El ladrón solo está bloqueado si tiene saldo NEGATIVO
    if (userData.balance < 0) {
      message.reply('estás en deuda, no puedes robar hasta salir de números rojos 😵');
      return;
    }

    // Probabilidad de éxito 40%, fallo 60%
    const success = Math.random() < 0.4;

    if (success) {
      // Roba entre 5% y 20% del balance EN MANO de la víctima
      const minSteal = Math.max(5, Math.floor(targetData.balance * 0.05));
      const maxSteal = Math.max(minSteal, Math.floor(targetData.balance * 0.20));
      const amount = Math.floor(Math.random() * (maxSteal - minSteal + 1)) + minSteal;

      // Todo el robo sale del BALANCE, nunca del banco
      targetData.balance -= amount;
      userData.balance += amount;
      userData.lastRob = now;
      saveData();

      const embed = new EmbedBuilder()
        .setTitle('💰 ¡Robo Exitoso!')
        .setColor(0x00b347)
        .setDescription(
          `Has robado **${money(amount)}** a ${target}.\n` +
          `Ahora tienes **${money(userData.balance)}** en mano.`
        );

      message.reply({ embeds: [embed] });
    } else {
      // Fallo: pierde entre 5% y 20% de su propio balance
      // Aquí SÍ permitimos que se vaya a negativo (deuda)
      const minLoss = Math.max(5, Math.floor(Math.abs(userData.balance) * 0.05));
      const maxLoss = Math.max(minLoss, Math.floor(Math.abs(userData.balance) * 0.20));
      const loss = Math.floor(Math.random() * (maxLoss - minLoss + 1)) + minLoss;

      userData.balance -= loss; // puede quedar negativo
      userData.lastRob = now;
      saveData();

      const embed = new EmbedBuilder()
        .setTitle('❌ ¡Robo Fallido!')
        .setColor(0xff0000)
        .setDescription(
          `La mala suerte te persigue... perdiste **${money(loss)}** en el intento.\n` +
          `Tu saldo ahora es **${money(userData.balance)}** (si es negativo, estás en deuda).`
        );

      message.reply({ embeds: [embed] });
    }

    return;
  }

  // !lp cv → ver cuánto falta para poder robar otra vez
  if (command === 'cv') {
    const now = Date.now();
    const COOLDOWN = 1000 * 60 * 60; // 1 hora

    if (userData.lastRob === 0 || now - userData.lastRob >= COOLDOWN) {
      message.reply('✅ Ya puedes usar `!lp rob` cuando quieras.');
      return;
    }

    const remaining = COOLDOWN - (now - userData.lastRob);
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    message.reply(
      `⌛ Te faltan **${minutes}m ${seconds}s** para poder robar de nuevo con \`!lp rob\`.`
    );
    return;
  }

  // !lp top → top 10 por dinero total (mano + banco)
  if (command === 'top') {
    const entries = Object.entries(data.users)
      .map(([id, info]) => ({
        id,
        total: (info.balance || 0) + (info.bank || 0),
      }))
      .filter(u => u.total > 0);

    if (entries.length === 0) {
      message.reply('Nadie tiene monedas todavía 😶');
      return;
    }

    const top = entries
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const lines = top
      .map((u, i) => `${i + 1}. <@${u.id}> — **${money(u.total)}**`)
      .join('\n');

    const embed = new EmbedBuilder()
      .setTitle('🏆 Top CASH de Lobby Points')
      .setColor(0xf1c40f)
      .setDescription(`Usuarios con más monedas:\n\n${lines}`)
      .setFooter({ text: `Jugadores totales: ${entries.length}` });

    message.reply({ embeds: [embed] });
    return;
  }

  // !lp give @usuario cantidad → dar monedas manualmente
  if (command === 'give') {
    const target = message.mentions.users.first();

    if (!target) {
      message.reply('Debes mencionar a un usuario: `!lp give @usuario cantidad`');
      return;
    }

    const amountArg = args.find((a) => !isNaN(parseInt(a)));
    const amount = parseInt(amountArg);

    if (!amount || amount <= 0) {
      message.reply('Cantidad inválida 💵');
      return;
    }

    // Solo admins
    if (!message.member.permissions.has('Administrator')) {
      message.reply('Solo administradores pueden usar este comando ⚠️');
      return;
    }

    ensureUser(target.id);
    data.users[target.id].balance += amount;
    saveData();

    message.reply(
      `✔️ Le diste **${money(amount)}** a **${target.username}**.\n` +
      `Ahora tiene **${money(data.users[target.id].balance)}** en mano.`
    );

    return;
  }

  // !lp remove @usuario cantidad → quitar monedas manualmente
  if (command === 'remove') {
    const target = message.mentions.users.first();

    if (!target) {
      message.reply('Debes mencionar a un usuario: `!lp remove @usuario cantidad`');
      return;
    }

    const amountArg = args.find((a) => !isNaN(parseInt(a)));
    const amount = parseInt(amountArg);

    if (!amount || amount <= 0) {
      message.reply('Cantidad inválida 💵');
      return;
    }

    if (!message.member.permissions.has('Administrator')) {
      message.reply('Solo administradores pueden usar este comando ⚠️');
      return;
    }

    ensureUser(target.id);

    if (amount > data.users[target.id].balance) {
      data.users[target.id].balance = 0;
    } else {
      data.users[target.id].balance -= amount;
    }

    saveData();

    message.reply(
      `❌ Le quitaste **${money(amount)}** a **${target.username}**.\n` +
      `Ahora tiene **${money(data.users[target.id].balance)}** en mano.`
    );

    return;
  }
});

// Botones + modal
client.on('interactionCreate', async (interaction) => {
  // 🔹 BOTONES
  if (interaction.isButton()) {
    const [prefix, action, ownerId] = interaction.customId.split(':');
    if (prefix !== 'bal') return;

    // solo el dueño del panel
    if (interaction.user.id !== ownerId) {
      return interaction.reply({
        content: 'Este panel no es tuyo 😼',
        ephemeral: true,
      });
    }

    ensureUser(ownerId);
    const userData = data.users[ownerId];
    const user = interaction.user;

    // Depositar TODO
    if (action === 'deposit') {
      if (userData.balance <= 0) {
        return interaction.reply({
          content: 'No tienes coins para depositar 😅',
          ephemeral: true,
        });
      }

      const amount = userData.balance;
      userData.balance = 0;
      userData.bank += amount;
      saveData();

      const embed = buildBalanceEmbed(user, userData);
      await interaction.update({ embeds: [embed] });
      return;
    }

    // Abrir modal para retirar cantidad específica
    if (action === 'withdraw') {
      const messageId = interaction.message.id;

      const modal = new ModalBuilder()
        .setCustomId(`withdrawModal:${ownerId}:${messageId}`)
        .setTitle('Retirar del banco');

      const amountInput = new TextInputBuilder()
        .setCustomId('withdrawAmount')
        .setLabel('Cantidad a retirar')
        .setPlaceholder('Ejemplo: 150')
        .setRequired(true)
        .setStyle(TextInputStyle.Short);

      const row = new ActionRowBuilder().addComponents(amountInput);
      modal.addComponents(row);

      await interaction.showModal(modal);
      return;
    }

    // Actualizar panel
    if (action === 'refresh') {
      const embed = buildBalanceEmbed(user, userData);
      await interaction.update({ embeds: [embed] });
      return;
    }

    return;
  }

  // 🔹 MODAL: retirar cantidad específica
  if (interaction.isModalSubmit()) {
    const [modalPrefix, ownerId, messageId] = interaction.customId.split(':');
    if (modalPrefix !== 'withdrawModal') return;

    if (interaction.user.id !== ownerId) {
      return interaction.reply({
        content: 'Este panel no es tuyo 😼',
        ephemeral: true,
      });
    }

    ensureUser(ownerId);
    const userData = data.users[ownerId];
    const user = interaction.user;

    const amountStr = interaction.fields.getTextInputValue('withdrawAmount').trim();
    const amountNum = parseInt(amountStr, 10);

    if (isNaN(amountNum) || amountNum <= 0) {
      return interaction.reply({
        content: 'Cantidad inválida 💵',
        ephemeral: true,
      });
    }

    if (userData.bank <= 0) {
      return interaction.reply({
        content: 'No tienes dinero en el banco 😅',
        ephemeral: true,
      });
    }

    if (amountNum > userData.bank) {
      return interaction.reply({
        content: `Solo tienes **${money(userData.bank)}** en el banco.`,
        ephemeral: true,
      });
    }

    userData.bank -= amountNum;
    userData.balance += amountNum;
    saveData();

    const embed = buildBalanceEmbed(user, userData);

    // Intentar editar el mensaje original del panel
    try {
      const msg = await interaction.channel.messages.fetch(messageId);
      await msg.edit({ embeds: [embed], components: msg.components });
    } catch (err) {
      console.error('Error actualizando mensaje de panel:', err);
    }

    await interaction.reply({
      content: `Has retirado **${money(amountNum)}** del banco 💸`,
      ephemeral: true,
    });

    return;
  }
});

client.login(process.env.DISCORD_TOKEN);