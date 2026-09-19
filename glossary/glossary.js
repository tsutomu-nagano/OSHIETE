(() => {
  'use strict';

  const surveySelect = document.querySelector('#survey-select');
  const termSearch = document.querySelector('#term-search');
  const surveyName = document.querySelector('#survey-name');
  const surveyCode = document.querySelector('#survey-code');
  const visibleCount = document.querySelector('#visible-count');
  const countLabel = document.querySelector('#count-label');
  const termList = document.querySelector('#term-list');
  const emptyMessage = document.querySelector('#empty-message');
  const errorMessage = document.querySelector('#error-message');
  let surveys = [];
  let termsById = new Map();
  let sourcesBySurvey = new Map();

  function normalized(value) {
    return String(value || '').normalize('NFKC').toLocaleLowerCase('ja');
  }

  function surveyTerms(code) {
    const termIds = new Set();
    (sourcesBySurvey.get(code) || []).forEach((source) => {
      (source.termIds || []).forEach((termId) => termIds.add(termId));
    });
    return [...termIds]
      .map((termId) => termsById.get(termId))
      .filter(Boolean)
      .sort((a, b) => a.term.localeCompare(b.term, 'ja'));
  }

  function createTermItem(term) {
    const item = document.createElement('li');
    const article = document.createElement('article');
    const heading = document.createElement('div');
    heading.className = 'term-heading';
    const title = document.createElement('span');
    title.className = 'term-name';
    title.textContent = term.term;
    const category = document.createElement('span');
    category.className = 'category';
    category.textContent = term.category || '未分類';
    const shortDescription = document.createElement('span');
    shortDescription.className = 'short-description';
    shortDescription.textContent = term.shortDescription;
    heading.append(title, category, shortDescription);

    const body = document.createElement('div');
    body.className = 'term-detail';
    const description = document.createElement('p');
    description.textContent = term.description;
    body.append(description);
    if (term.aliases?.length) {
      const aliases = document.createElement('p');
      aliases.className = 'metadata';
      aliases.textContent = `別名：${term.aliases.join('、')}`;
      body.append(aliases);
    }
    article.append(heading, body);
    item.append(article);
    return item;
  }

  function render() {
    const selectedSurvey = surveys.find((survey) => survey.code === surveySelect.value);
    if (!selectedSurvey) return;
    const query = normalized(termSearch.value.trim());
    const allTerms = surveyTerms(selectedSurvey.code);
    const filteredTerms = allTerms.filter((term) => normalized([
      term.term,
      ...(term.aliases || []),
      term.shortDescription,
      term.description,
      term.category
    ].join(' ')).includes(query));

    surveyName.textContent = selectedSurvey.name;
    surveyCode.textContent = `政府統計コード：${selectedSurvey.code}`;
    visibleCount.textContent = String(filteredTerms.length);
    countLabel.textContent = query ? `語を表示（全${allTerms.length}語）` : '語を登録';
    termList.replaceChildren(...filteredTerms.map(createTermItem));
    emptyMessage.hidden = filteredTerms.length !== 0;
    const url = new URL(location.href);
    url.searchParams.set('toukei', selectedSurvey.code);
    history.replaceState(null, '', url);
  }

  async function initialize() {
    try {
      const [surveyResponse, termResponse, sourceResponse] = await Promise.all([
        fetch(chrome.runtime.getURL('dictionary/surveys.json')),
        fetch(chrome.runtime.getURL('dictionary/terms.json')),
        fetch(chrome.runtime.getURL('dictionary/sources.json'))
      ]);
      if (![surveyResponse, termResponse, sourceResponse].every((response) => response.ok)) {
        throw new Error('辞書ファイルを読み込めませんでした。');
      }
      const [surveyData, terms, sources] = await Promise.all([
        surveyResponse.json(), termResponse.json(), sourceResponse.json()
      ]);
      if (![surveyData, terms, sources].every(Array.isArray)) {
        throw new Error('辞書ファイルの形式が正しくありません。');
      }
      termsById = new Map(terms.map((term) => [term.id, term]));
      sources.forEach((source) => {
        const code = source.officialStatisticsCode;
        if (!code) return;
        const surveySources = sourcesBySurvey.get(code) || [];
        surveySources.push(source);
        sourcesBySurvey.set(code, surveySources);
      });
      surveys = surveyData.filter((survey) => sourcesBySurvey.has(survey.code));
      surveySelect.replaceChildren(...surveys.map((survey) => {
        const option = document.createElement('option');
        option.value = survey.code;
        option.textContent = `${survey.name}（${surveyTerms(survey.code).length}語）`;
        return option;
      }));
      const requestedCode = new URL(location.href).searchParams.get('toukei');
      if (surveys.some((survey) => survey.code === requestedCode)) surveySelect.value = requestedCode;
      render();
    } catch (error) {
      errorMessage.textContent = error.message;
      errorMessage.hidden = false;
      surveyName.textContent = '一覧を表示できませんでした';
      surveyCode.textContent = '';
      visibleCount.textContent = '0';
    }
  }

  surveySelect.addEventListener('change', () => {
    termSearch.value = '';
    render();
  });
  termSearch.addEventListener('input', render);
  initialize();
})();
