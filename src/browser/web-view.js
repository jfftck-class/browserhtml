/* @flow */

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*:: import * as type from "../../type/browser/web-view" */

import {Effects, html} from 'reflex';
import {merge, always} from '../common/prelude';
import {on, onCanGoBackChange, onCanGoForwardChange} from 'driver';
import * as Shell from './web-view/shell';
import * as Progress from './web-view/progress';
import * as Navigation from './web-view/navigation';
import * as Security from './web-view/security';
import * as Page from './web-view/page';
import {Style, StyleSheet} from '../common/style';
import * as Driver from 'driver';
import * as URI from '../common/url-helper';

export const RequestZoomIn = Shell.asRequest(Shell.ZoomIn);
export const RequestZoomOut = Shell.asRequest(Shell.ZoomOut);
export const RequestZoomReset = Shell.asRequest(Shell.ResetZoom);
export const RequestMakeVisibile = Shell.asRequest(Shell.asChangeVisibility(true));
export const RequestMakeNotVisibile = Shell.asRequest(Shell.asChangeVisibility(false));

export const Select/*:type.Select*/
  = {type: "WebView.Select"};

export const Activate/*:type.Activate*/
  = {type: "WebView.Activate"};

export const Close/*:type.Close*/
  = {type: "WebView.Close"};

export const open/*:type.open*/ = (id, options) => ({
  id: id,
  name: options.name,
  features: options.name,
  isSelected: false,
  isActive: false,
  shell: Shell.initial,
  security: Security.initial,
  navigation: Navigation.initiate(options.uri),
  progress: null,
  page: null
})

const selected = {isSelected: true};
const unselected = {isSelected: false};

export const select/*:type.select*/ = model =>
  model.isSelected ?
    model :
    merge(model, selected);

export const unselect/*:type.unselect*/ = model =>
  model.isSelected ?
    merge(model, unselected) :
    model;

export const activate/*:type.activate*/ = model =>
  model.isActive ?
    model :
    merge(model, {
      isActive: true,
      shell: Shell.focus(model.shell)
    });

export const deactivate/*:type.deactivate*/ = model =>
  model.isActive ?
    merge(model, {
      isActive: false,
      shell: Shell.blur(model.shell)
    }) :
    model;

export const asLoad = Navigation.asLoad;

export const readTitle/*:type.readTitle*/ = (model, fallback) =>
  (model.page && model.page.title && model.page.title !== '') ?
    model.page.title :
  URI.hasScheme(model.navigation.currentURI) ?
    URI.prettify(model.navigation.currentURI) :
  fallback;

export const readFaviconURI/*:type.readFaviconURI*/ = (model) =>
  model.page && model.page.faviconURI ?
    model.page.faviconURI :
  // @TODO use a proper URL.join function. Need to add this to url-helper lib.
  `${model.navigation.currentURI}/favicon.ico`;

export const isDark/*:type.isDark*/ = (model) =>
  model.page ? model.page.pallet.isDark : false;

export const step/*:type.step*/ = (model, action) => {
  // Shell actions
  if (action.type === "WebView.Select") {
    return [select(model), Effects.none];
  }
  else if (action.type === "WebView.Activate") {
    return [activate(model), Effects.none];
  }
  else if (action.type === "Focusable.FocusRequest") {
    return [activate(model), Effects.none];
  }
  else if (action.type === "Focusable.Focus") {
    return [activate(model), Effects.none];
  }
  else if (action.type === "Focusable.Blur") {
    const [shell, fx] = Shell.step(model.shell, action);
    return [merge(model, {shell}), fx];
  }
  // Progress actions
  else if (action.type === 'WebView.Progress.Tick')
  {
    const [progress, fx] = Progress.step(model.progress, action);
    return [merge(model, {progress}), fx];
  }
  else if (action.type === 'WebView.Progress.Start') {
    const [progress, progressFx] = Progress.start(action.timeStamp);
    const [page, pageFx] = Page.start(model.navigation.currentURI);
    const security = Security.initial;

    return [
      merge(model, {progress, page, security}),
      Effects.batch([
        progressFx,
        pageFx
      ])
    ]
  }
  else if (action.type === 'WebView.Progress.End') {
    const [progress, fx] = Progress.step(model.progress, action);

    return [merge(model, {progress}), fx];
  }
  else if (action.type === 'WebView.Navigation.Stop') {
    return [model, Navigation.stop(model.id)];
  }
  else if (action.type === 'WebView.Navigation.Reload') {
    return [model, Navigation.reload(model.id)];
  }
  else if (action.type === 'WebView.Navigation.GoBack') {
    return [model, Navigation.goBack(model.id)];
  }
  else if (action.type === 'WebView.Navigation.GoForward') {
    return [model, Navigation.goForward(model.id)];
  }
  else if (action.type === 'WebView.Navigation.Load') {
    const [navigation, fx] = Navigation.step(model.navigation, action);
    return [merge(model, {navigation}), fx];
  }
  else if (action.type === 'WebView.Navigation.LocationChanged') {
    const [navigation, fx] = Navigation.step(model.navigation, action);
    return [
      merge(model, {navigation}),
      Effects.batch([
        fx,
        Navigation.fetchCanGoBack(model.id),
        Navigation.fetchCanGoForward(model.id)
      ])
    ];
  }
  else if (action.type === 'WebView.Security.Changed') {
    const [security, fx] = Security.step(model.security, action);
    return [merge(model, {security}), fx];
  }
  // Page actions
 else if (action.type === 'WebView.Page.ScreenshotUpdate'
        || action.type === 'WebView.Page.CuratedColorUpdate'
        || action.type === 'WebView.Page.ColorScraped'
        || action.type === 'WebView.Page.DocumentFirstPaint'
        || action.type === 'WebView.Page.FirstPaint'
        || action.type === 'WebView.Page.MetaChanged'
        || action.type === 'WebView.Page.TitleChanged'
        || action.type === 'WebView.Page.IconChanged'
        || action.type === 'WebView.Page.OverflowChanged'
        || action.type === 'WebView.Page.Scrolled')
  {
    const [page, fx] = Page.step(model.page, action);
    return [merge(model, {page}), fx];
  }
  else if (action.type === "WebView.Shell.Request") {
    const request = Shell.asRequestBy(model.id, action.action);
    const [shell, fx] = Shell.step(model.shell, request);
    return [merge(model, {shell}), fx];
  }
  else if (action.type === "WebView.Shell.ZoomChanged" ||
           action.type === "WebView.Shell.VisibilityChanged") {
    const [shell, fx] = Shell.step(model.shell, action);
    return [merge(model, {shell}), fx];
  }
  else {
    return [model, Effects.none];
  }
}

const topBarHeight = '27px';
const topBarMaxHeight = '66vh';
const comboboxHeight = '21px';
const comboboxWidth = '250px';

const style = StyleSheet.create({
  webview: {
    position: 'absolute', // to stack webview on top of each other
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    mozUserSelect: 'none',
    cursor: 'default',
  },

  webViewInactive: {
    pointerEvents: 'none',
    visibility: 'hidden',
    opacity: 0,
  },

  iframe: {
    display: 'block', // iframe are inline by default
    position: 'absolute',
    top: topBarHeight,
    left: 0,
    width: '100%',
    height: `calc(100% - ${topBarHeight})`,
    mozUserSelect: 'none', // necessary to pass text drag to iframe's content
    borderWidth: 0,
    backgroundColor: 'white',
  },

  topbar: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: topBarHeight + 'px',
  },

  topbarBackground: {
    position: 'absolute',
    height: topBarMaxHeight,
    width: '100%',
    top: 0,
    left: 0,
    transform: `translateY(calc(-1 * ${topBarMaxHeight} + ${topBarHeight}))`,
    backgroundColor: 'white', // dynamic
  },

  combobox: {
    position: 'absolute',
    left: '50%',
    top: 0,
    height: comboboxHeight,
    lineHeight: comboboxHeight,
    width: comboboxWidth,
    marginTop: `calc(${topBarHeight} / 2 - ${comboboxHeight} / 2)`,
    marginLeft: `calc(${comboboxWidth} / -2)`,
    color: 'rgba(0, 0, 0, 0.8)',
    borderRadius: '5px',
    cursor: 'text',
  },

  titleContainer: {
    color: 'rgba(0,0,0,0.8)',
    position: 'absolute',
    top: 0,
    left: 0,
    paddingLeft: '30px',
    paddingRight: '30px',
    width: 'calc(100% - 60px)',
    textAlign: 'center',
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },

  // Also has some hover styles defined in theme.css
  iconSearch: {
    color: 'rgba(0,0,0,0.7)',
    fontFamily: 'FontAwesome',
    fontSize: '14px',
    left: '5px',
    position: 'absolute',
  },

  iconSecure: {
    fontFamily: 'FontAwesome',
    color: 'rgba(0,0,0,0.7)',
    marginRight: '6px'
  },

  iconInsecure: {
    display: 'none'
  }
});

const viewFrame = (model, address) =>
  html.iframe({
    id: `web-view-${model.id}`,
    src: model.navigation.initiatedURI,
    'data-current-uri': model.navigation.currentURI,
    'data-name': model.name,
    'data-features': model.features,
    element: Driver.element,
    style: Style(style.iframe),
    attributes: {
      mozbrowser: true,
      remote: true,
      mozapp: URI.isPrivileged(model.navigation.currentURI) ?
                URI.getManifestURL().href :
                void(0),
      mozallowfullscreen: true
    },
    // isVisible: visiblity(model.isActive),
    // zoom: zoom(model.shell.zoom),

    isFocused: Driver.focus(model.shell.isFocused),

    // Events

    onBlur: on(address, decodeBlur),
    onFocus: on(address, decodeFocus),
    // onMozbrowserAsyncScroll: on(address, decodeAsyncScroll),
    onMozBrowserClose: on(address, decodeClose),
    onMozBrowserOpenWindow: on(address, decodeOpenWindow),
    onMozBrowserOpenTab: on(address, decodeOpenTab),
    onMozBrowserContextMenu: on(address, decodeContexMenu),
    onMozBrowserError: on(address, decodeError),
    onMozBrowserLoadStart: on(address, decodeLoadStart),
    onMozBrowserLoadEnd: on(address, decodeLoadEnd),
    onMozBrowserFirstPaint: on(address, decodeFirstPaint),
    onMozBrowserDocumentFirstPaint: on(address, decodeDocumentFirstPaint),
    onMozBrowserLoadProgressChange: on(address, decodeProgressChange),
    onMozBrowserLocationChange: on(address, decodeLocationChange),
    onMozBrowserMetaChange: on(address, decodeMetaChange),
    onMozBrowserIconChange: on(address, decodeIconChange),
    onMozBrowserLocationChange: on(address, decodeLocationChange),
    onMozBrowserSecurityChange: on(address, decodeSecurityChange),
    onMozBrowserTitleChange: on(address, decodeTitleChange),
    onMozBrowserShowModalPrompt: on(address, decodeShowModalPrompt),
    onMozBrowserUserNameAndPasswordRequired: on(address, decodeAuthenticate),
    onMozBrowserScrollAreaChanged: on(address, decodeScrollAreaChange),
  });

export const view/*:type.view*/ = (model, address) =>
  html.div({
    className: isDark(model) ? 'webview webview-is-dark' : 'webview',
    style: Style(
      style.webview,
      !model.isActive && style.webViewInactive
    )
  }, [
    viewFrame(model, address),
    html.div({className: 'webview-local-overlay'}),
    html.div({
      className: 'webview-topbar',
      style: style.topbar
    }, [
      html.div({
        className: 'webview-topbar-background',
        style: style.topbarBackground
      }),
      html.div({
        className: 'webview-combobox',
        style: style.combobox
      }, [
        html.span({
          className: 'webview-search-icon',
          style: style.iconSearch
        }, ['']),
        html.div({
          className: 'webview-title-container',
          style: style.titleContainer
        }, [
          html.span({
            className: 'webview-security-icon',
            style: model.security.secure ?
              style.iconSecure : style.iconInsecure
          }, ['']),
          html.span({
            className: 'webview-title'
          }, [
            // @TODO localize this string
            readTitle(model, 'Untitled')
          ])
        ])
      ]),
      html.div({className: 'webview-show-sidebar-button'})
    ]),
    Progress.view(model.progress, address)
  ]);



const decodeClose = always(Close);


const decodeOpenWindow = ({detail}) => {
  Driver.element.use(detail.frameElement);
  return {
    type: "WebViews.Open!WithMyIFrameAndInTheCurrentTick",
    inBackground: false,
    uri: detail.uri,
    name: detail.name,
    features: detail.features
  };
};

const decodeOpenTab = ({detail}) => {
  Driver.element.use(detail.frameElement);
  return {
    type: "WebViews.Open!WithMyIFrameAndInTheCurrentTick",
    inBackground: true,
    uri: detail.uri,
    name: detail.name,
    features: detail.features
  };
};

// TODO: Figure out what's in detail
const decodeContexMenu = ({detail}) =>
  ({type: "WebView.ContextMenu", detail});

// TODO: Figure out what's in detail
const decodeShowModalPrompt = ({detail}) =>
  ({type: "WebView.ModalPrompt", detail});

// TODO: Figure out what's in detail
const decodeAuthenticate = ({detail}) =>
  ({type: "WebView.Authentificate", detail});

// TODO: Figure out what's in detail
const decodeError = ({detail}) =>
  ({type: "WebView.Failure", detail});

// Shell

const decodeFocus = always(Shell.Focus);
const decodeBlur = always(Shell.Blur);

// Navigation

const decodeLocationChange = ({detail: uri, timeStamp}) =>
  Navigation.asLocationChanged(uri, timeStamp);

// Progress

// @TODO This is not ideal & we should probably convert passed `timeStamp` to
// the same format as `performance.now()` so that time passed through animation
// frames is in the same format, but for now we just call `performance.now()`.

const decodeLoadStart = ({timeStamp}) =>
  Progress.asStart(performance.now());

const decodeProgressChange = ({timeStamp}) =>
  Progress.asChange(performance.now());

const decodeLoadEnd = ({timeStamp}) =>
  Progress.asEnd(performance.now());

// Page

const decodeFirstPaint = always(Page.FirstPaint);
const decodeDocumentFirstPaint = always(Page.DocumentFirstPaint);

const decodeTitleChange = ({detail: title}) =>
  Page.asTitleChanged(title);

const decodeIconChange = ({target, detail: icon}) =>
  Page.asIconChanged(icon);

const decodeMetaChange = ({detail: {content, name}}) =>
  Page.asMetaChanged(name, content);

// TODO: Figure out what's in detail
const decodeAsyncScroll = ({detail}) =>
  Page.asScrolled(detail);

const decodeScrollAreaChange = ({detail, target}) =>
  Page.asOverflowChanged(detail.height > target.parentNode.clientHeight);

const decodeSecurityChange = ({detail}) =>
  Security.asChanged(detail.state, detail.extendedValidation);
