
class YAWNError extends Error {
  constructor(message) {
    super(message);
    this.message = message;
    this.name = 'YAWNError';
  }
}

export default YAWNError;
