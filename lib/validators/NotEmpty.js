function NotEmpty() {
  this.lang = 'en';
  this.messageTemplates = {
    'en': {
      'isEmpty': 'This field is required'
    },
    'th': {
      'isEmpty': 'กรุณากรอกข้อมูล'
    }
  };
  this.messages = [];
}

NotEmpty.prototype.setLanguage(lang) {
  this.lang = lang;
}

NotEmpty.prototype.isValid = function(value) {
  if (this.value.length < 1) {
    this.messages['isEmpty'] = this.messageTemplates[this.lang]['isEmpty'];
    return false;
  }
  return true;
}

modules.exports = NotEmpty;
