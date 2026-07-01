(function () {
  'use strict';

  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) {
      io.observe(el);
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add('is-visible');
    });
  }

  function updatePreview(container, src, altText) {
    if (!container) {
      return;
    }

    container.setAttribute('data-media-preview-src', src);
    container.setAttribute('data-media-preview-alt', altText || 'Preview image');

    var existingImage = container.querySelector('img');
    if (existingImage) {
      existingImage.src = src;
      existingImage.alt = altText || 'Preview image';
      return;
    }

    container.innerHTML = '';
    var image = document.createElement('img');
    image.src = src;
    image.alt = altText || 'Preview image';
    container.appendChild(image);
  }

  function previewSelectedFile(input, container, emptyMarkup) {
    if (!input || !container) {
      return;
    }

    var file = input.files && input.files[0];

    if (!file) {
      container.innerHTML = emptyMarkup || '<span>Select a file to preview it before upload.</span>';
      container.removeAttribute('data-media-preview-src');
      container.removeAttribute('data-media-preview-alt');
      return;
    }

    var reader = new FileReader();
    reader.onload = function (event) {
      updatePreview(container, event.target.result, file.name);
    };
    reader.readAsDataURL(file);
  }

  var editors = document.querySelectorAll('[data-rich-editor]');

  editors.forEach(function (editor) {
    var surface = editor.querySelector('[data-rich-editor-surface]');
    var source = editor.querySelector('[data-rich-editor-source]');
    var toolbar = editor.querySelector('[data-rich-editor-toolbar]');

    if (!surface || !source || !toolbar) {
      return;
    }

    editor.classList.add('is-enhanced');
    surface.innerHTML = source.value || '<p></p>';

    var syncSource = function () {
      source.value = surface.innerHTML;
    };

    var normalizeUrl = function (url) {
      var trimmed = (url || '').trim();
      if (!trimmed) {
        return '';
      }

      if (/^(https?:|mailto:|tel:|\/|#)/i.test(trimmed)) {
        return trimmed;
      }

      return 'https://' + trimmed;
    };

    var findSelectedAnchor = function () {
      if (!window.getSelection) {
        return null;
      }

      var selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return null;
      }

      var node = selection.anchorNode;
      if (!node) {
        return null;
      }

      if (node.nodeType === Node.TEXT_NODE) {
        node = node.parentElement;
      }

      if (!node || !node.closest) {
        return null;
      }

      return node.closest('a');
    };

    var applyLinkTarget = function (anchor, openInNewTab) {
      if (!anchor) {
        return;
      }

      if (openInNewTab) {
        anchor.setAttribute('target', '_blank');
        anchor.setAttribute('rel', 'noopener noreferrer');
      } else {
        anchor.removeAttribute('target');
        anchor.removeAttribute('rel');
      }
    };

    toolbar.addEventListener('click', function (event) {
      var button = event.target.closest('[data-command]');
      if (!button) {
        return;
      }

      event.preventDefault();
      surface.focus();

      var command = button.getAttribute('data-command');
      var value = button.getAttribute('data-value');

      if (command === 'editLink') {
        var activeAnchor = findSelectedAnchor();
        if (!activeAnchor) {
          window.alert('Place the cursor inside a link to edit it.');
          return;
        }

        var currentHref = activeAnchor.getAttribute('href') || '';
        var nextUrl = window.prompt('Update link URL (leave blank to remove link):', currentHref);
        if (nextUrl === null) {
          return;
        }

        var normalizedNextUrl = normalizeUrl(nextUrl);
        if (!normalizedNextUrl) {
          document.execCommand('unlink', false, null);
          syncSource();
          return;
        }

        activeAnchor.setAttribute('href', normalizedNextUrl);

        var openInNewTab = window.confirm('Open this link in a new tab? Click Cancel for same tab.');
        applyLinkTarget(activeAnchor, openInNewTab);
      } else if (command === 'createLink') {
        var selectedText = window.getSelection ? window.getSelection().toString().trim() : '';
        if (!selectedText) {
          window.alert('Select text first, then add a link.');
          return;
        }

        var rawUrl = window.prompt('Enter a URL (example: https://example.com):', 'https://');
        if (rawUrl === null) {
          return;
        }

        var normalizedUrl = normalizeUrl(rawUrl);
        if (!normalizedUrl) {
          window.alert('Please enter a valid URL.');
          return;
        }

        document.execCommand('createLink', false, normalizedUrl);

        var anchor = findSelectedAnchor();
        if (anchor) {
          applyLinkTarget(anchor, button.getAttribute('data-link-target') === '_blank');
        }
      } else if (command === 'formatBlock') {
        document.execCommand(command, false, value || 'p');
      } else {
        document.execCommand(command, false, value || null);
      }

      syncSource();
    });

    surface.addEventListener('input', syncSource);
    surface.addEventListener('blur', syncSource);

    var form = editor.closest('form');
    if (form) {
      form.addEventListener('submit', syncSource);
    }
  });

  var featuredImageInput = document.querySelector('[data-featured-image-input]');
  var featuredImagePreview = document.querySelector('[data-featured-image-preview]');

  if (featuredImageInput && featuredImagePreview) {
    featuredImageInput.addEventListener('change', function () {
      previewSelectedFile(featuredImageInput, featuredImagePreview, '<span>No image selected yet.</span>');
    });
  }

  var adminShell = document.querySelector('.admin-shell');
  var adminNavToggle = document.querySelector('[data-admin-nav-toggle]');
  var adminNavCloseButtons = document.querySelectorAll('[data-admin-nav-close]');
  var adminNavLinks = document.querySelectorAll('.admin-nav__link, .admin-nav__sublink, .admin-nav__section-label');

  function setAdminNavState(isOpen) {
    if (!adminShell) {
      return;
    }

    adminShell.classList.toggle('is-nav-open', Boolean(isOpen));
    document.body.classList.toggle('admin-nav-open', Boolean(isOpen));

    if (adminNavToggle) {
      adminNavToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
  }

  if (adminNavToggle && adminShell) {
    adminNavToggle.addEventListener('click', function () {
      setAdminNavState(!adminShell.classList.contains('is-nav-open'));
    });

    adminNavCloseButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        setAdminNavState(false);
      });
    });

    adminNavLinks.forEach(function (link) {
      link.addEventListener('click', function () {
        if (window.innerWidth <= 980) {
          setAdminNavState(false);
        }
      });
    });

    window.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        setAdminNavState(false);
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 980) {
        setAdminNavState(false);
      }
    });
  }

  var categorySelect = document.querySelector('[data-category-select]');
  var categoryHiddenInput = document.querySelector('[data-category-hidden-input]');
  var categoryCustomWrap = document.querySelector('[data-category-custom-wrap]');
  var categoryCustomInput = document.querySelector('[data-category-custom-input]');
  var categoryClearButton = document.querySelector('[data-category-clear]');

  function syncCategoryValue() {
    if (!categorySelect || !categoryHiddenInput) {
      return;
    }

    if (categorySelect.value === '__custom__') {
      if (categoryCustomWrap) {
        categoryCustomWrap.hidden = false;
      }

      var customCategory = categoryCustomInput ? categoryCustomInput.value.trim() : '';
      categoryHiddenInput.value = customCategory || 'Uncategorized';
      return;
    }

    if (categoryCustomWrap) {
      categoryCustomWrap.hidden = true;
    }
    categoryHiddenInput.value = categorySelect.value || 'Uncategorized';
  }

  if (categorySelect && categoryHiddenInput) {
    categorySelect.addEventListener('change', function () {
      syncCategoryValue();
      if (categorySelect.value === '__custom__' && categoryCustomInput) {
        categoryCustomInput.focus();
      }
    });

    if (categoryCustomInput) {
      categoryCustomInput.addEventListener('input', syncCategoryValue);
      categoryCustomInput.addEventListener('blur', syncCategoryValue);
    }

    if (categoryClearButton) {
      categoryClearButton.addEventListener('click', function () {
        if (categoryCustomInput) {
          categoryCustomInput.value = '';
        }
        categorySelect.value = 'Uncategorized';
        syncCategoryValue();
      });
    }

    syncCategoryValue();
  }

  var tagsHiddenInput = document.querySelector('[data-tags-hidden-input]');
  var tagCustomInput = document.querySelector('[data-tag-custom-input]');
  var tagAddCustomButton = document.querySelector('[data-tag-add-custom]');
  var tagClearButton = document.querySelector('[data-tag-clear]');
  var tagList = document.querySelector('[data-tag-list]');
  var tagOptionButtons = document.querySelectorAll('[data-tag-option]');

  function normalizeTag(value) {
    return String(value || '').trim();
  }

  function parseTagList(raw) {
    return String(raw || '')
      .split(',')
      .map(function (tag) {
        return normalizeTag(tag);
      })
      .filter(Boolean);
  }

  function uniqueTags(values) {
    var seen = {};
    return values.filter(function (value) {
      var normalized = normalizeTag(value);
      if (!normalized) {
        return false;
      }

      var key = normalized.toLowerCase();
      if (seen[key]) {
        return false;
      }

      seen[key] = true;
      return true;
    });
  }

  function setTags(nextTags) {
    if (!tagsHiddenInput) {
      return;
    }

    var normalizedTags = uniqueTags(nextTags.map(function (tag) {
      return normalizeTag(tag);
    }));

    tagsHiddenInput.value = normalizedTags.join(', ');

    if (!tagList) {
      return;
    }

    tagList.innerHTML = '';
    if (!normalizedTags.length) {
      var empty = document.createElement('span');
      empty.className = 'form__note';
      empty.textContent = 'No tags selected.';
      tagList.appendChild(empty);
      return;
    }

    normalizedTags.forEach(function (tag) {
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'btn btn--ghost';
      item.setAttribute('data-tag-remove', tag);
      item.textContent = tag + ' x';
      tagList.appendChild(item);
    });
  }

  function addTag(value) {
    if (!tagsHiddenInput) {
      return;
    }

    var nextTag = normalizeTag(value);
    if (!nextTag) {
      return;
    }

    var current = parseTagList(tagsHiddenInput.value);
    current.push(nextTag);
    setTags(current);
  }

  if (tagsHiddenInput) {
    setTags(parseTagList(tagsHiddenInput.value));

    if (tagAddCustomButton && tagCustomInput) {
      tagAddCustomButton.addEventListener('click', function () {
        addTag(tagCustomInput.value);
        tagCustomInput.value = '';
        tagCustomInput.focus();
      });

      tagCustomInput.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter') {
          return;
        }

        event.preventDefault();
        addTag(tagCustomInput.value);
        tagCustomInput.value = '';
      });
    }

    if (tagClearButton) {
      tagClearButton.addEventListener('click', function () {
        setTags([]);
      });
    }

    if (tagOptionButtons.length) {
      tagOptionButtons.forEach(function (button) {
        button.addEventListener('click', function () {
          addTag(button.getAttribute('data-tag-option'));
        });
      });
    }

    if (tagList) {
      tagList.addEventListener('click', function (event) {
        var removeButton = event.target.closest('[data-tag-remove]');
        if (!removeButton) {
          return;
        }

        var removeTag = removeButton.getAttribute('data-tag-remove');
        var remaining = parseTagList(tagsHiddenInput.value).filter(function (tag) {
          return tag.toLowerCase() !== String(removeTag || '').toLowerCase();
        });
        setTags(remaining);
      });
    }
  }

  var confirmDeleteForms = document.querySelectorAll('form[data-confirm-delete]');
  confirmDeleteForms.forEach(function (form) {
    form.addEventListener('submit', function (event) {
      var title = form.getAttribute('data-confirm-title');
      var message = title
        ? 'Delete "' + title + '"? This action cannot be undone.'
        : 'Delete this item? This action cannot be undone.';

      if (!window.confirm(message)) {
        event.preventDefault();
      }
    });
  });

  var mediaUploadForm = document.querySelector('[data-media-upload-form]');
  var mediaUploadInput = document.querySelector('[data-media-upload-input]');
  var mediaUploadPreview = document.querySelector('[data-media-upload-preview]');

  if (mediaUploadInput && mediaUploadPreview) {
    mediaUploadInput.addEventListener('change', function () {
      previewSelectedFile(mediaUploadInput, mediaUploadPreview, '<span>Select a file to preview it before upload.</span>');
    });
  }

  if (mediaUploadForm && window.FormData && window.fetch) {
    mediaUploadForm.addEventListener('submit', function (event) {
      event.preventDefault();

      var formData = new FormData(mediaUploadForm);
      fetch(mediaUploadForm.action, {
        method: 'POST',
        body: formData,
        headers: { Accept: 'application/json' },
      })
        .then(function (response) {
          return response.json().then(function (payload) {
            if (!response.ok) {
              throw new Error(payload.error || 'Unable to upload media.');
            }
            return payload;
          });
        })
        .then(function (payload) {
          var success = document.querySelector('.form__success');
          var error = document.querySelector('.form__error');
          if (error) {
            error.classList.remove('show');
          }
          if (success) {
            success.textContent = 'Media uploaded successfully.';
            success.classList.add('show');
          }
          mediaUploadForm.reset();

          window.setTimeout(function () {
            window.location.href = '/admin/media#media-feedback-anchor';
          }, 250);
        })
        .catch(function (error) {
          var success = document.querySelector('.form__success');
          var errorBox = document.querySelector('.form__error');
          if (success) {
            success.classList.remove('show');
          }
          if (errorBox) {
            errorBox.textContent = error.message;
            errorBox.classList.add('show');
          }
        });
    });
  }

  var copyMediaButtons = document.querySelectorAll('[data-copy-media-url]');
  copyMediaButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      var mediaUrl = button.getAttribute('data-copy-media-url');
      if (!mediaUrl) {
        return;
      }

      var absoluteUrl = window.location.origin + mediaUrl;
      var onSuccess = function () {
        var success = document.querySelector('.form__success');
        var error = document.querySelector('.form__error');
        if (error) {
          error.classList.remove('show');
        }
        if (success) {
          success.textContent = 'Media URL copied to clipboard.';
          success.classList.add('show');
        }
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(absoluteUrl).then(onSuccess).catch(function () {
          window.prompt('Copy this URL:', absoluteUrl);
        });
        return;
      }

      window.prompt('Copy this URL:', absoluteUrl);
    });
  });

  var mediaEditToggleButtons = document.querySelectorAll('[data-media-toggle-edit]');
  mediaEditToggleButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      var card = button.closest('.media-card');
      var editPanel = card ? card.querySelector('.media-card__edit') : null;
      if (!editPanel) {
        return;
      }

      editPanel.hidden = !editPanel.hidden;
      if (!editPanel.hidden) {
        var input = editPanel.querySelector('input[name="filename"]');
        if (input) {
          input.focus();
          input.select();
        }
      }
    });
  });

  var mediaEditCancelButtons = document.querySelectorAll('[data-media-cancel-edit]');
  mediaEditCancelButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      var panel = button.closest('.media-card__edit');
      if (panel) {
        panel.hidden = true;
      }
    });
  });

  var mediaModal = document.querySelector('[data-media-modal]');
  var mediaModalImage = document.querySelector('[data-media-modal-image]');
  var mediaModalCaption = document.querySelector('[data-media-modal-caption]');

  function openMediaModal(src, caption) {
    if (!mediaModal || !mediaModalImage || !mediaModalCaption) {
      return;
    }

    mediaModalImage.src = src;
    mediaModalImage.alt = caption || 'Media preview';
    mediaModalCaption.textContent = caption || '';
    mediaModal.classList.add('is-open');
    mediaModal.setAttribute('aria-hidden', 'false');
  }

  function closeMediaModal() {
    if (!mediaModal || !mediaModalImage || !mediaModalCaption) {
      return;
    }

    mediaModal.classList.remove('is-open');
    mediaModal.setAttribute('aria-hidden', 'true');
    mediaModalImage.src = '';
    mediaModalCaption.textContent = '';
  }

  document.addEventListener('click', function (event) {
    var mediaTrigger = event.target.closest('[data-media-preview-src]');
    if (mediaTrigger) {
      openMediaModal(mediaTrigger.getAttribute('data-media-preview-src'), mediaTrigger.getAttribute('data-media-preview-alt'));
      return;
    }

    if (event.target.closest('[data-media-modal-close]')) {
      closeMediaModal();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      closeMediaModal();
    }
  });
})();