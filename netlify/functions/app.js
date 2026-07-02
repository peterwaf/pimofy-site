const serverless = require('serverless-http');
const app = require('../../app');

let bootstrapPromise;

async function bootstrap() {
	if (!bootstrapPromise) {
		bootstrapPromise = (async () => {
			if (app.locals.sessionStore && typeof app.locals.sessionStore.sync === 'function') {
				await app.locals.sessionStore.sync();
			}
		})().catch(error => {
			bootstrapPromise = null;
			throw error;
		});
	}

	return bootstrapPromise;
}

const appHandler = serverless(app);

exports.handler = async (event, context) => {
	await bootstrap();
	return appHandler(event, context);
};
