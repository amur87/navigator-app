const appleAuth = {
    isSupported: false,
    Operation: {
        LOGIN: 'LOGIN',
    },
    Scope: {
        EMAIL: 'EMAIL',
        FULL_NAME: 'FULL_NAME',
    },
    async performRequest() {
        throw new Error('Apple Sign-In is not supported on web.');
    },
};

module.exports = { appleAuth };
module.exports.default = { appleAuth };
