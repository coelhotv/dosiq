import { Expo } from 'expo-server-sdk'

const expo = new Expo()
const token = 'ExponentPushToken[Tre9agIh9AUQ4P4CDOTjKx]'

const messages = [{
  to: token,
  sound: 'default',
  title: 'MUITO AMOR!',
  body: 'Funcionou via SDK?'
}]

const chunks = expo.chunkPushNotifications(messages)
for (const chunk of chunks) {
  const tickets = await expo.sendPushNotificationsAsync(chunk)
  console.log(JSON.stringify(tickets, null, 2))
}
