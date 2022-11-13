import LZString from 'lz-string';
import { useEffect, useState } from 'react';
import { ANTD_VERSION, G6_VERSION, GI_VERSION, GRAPHIN_VERSION } from '../../.umirc';
import { getActivePackage, getConstantFiles } from './common';

const CSB_API_ENDPOINT = 'https://codesandbox.io/api/v1/sandboxes/define';

function serialize(data: Record<string, any>) {
  return LZString.compressToBase64(JSON.stringify(data))
    .replace(/\+/g, '-') // Convert '+' to '-'
    .replace(/\//g, '_') // Convert '/' to '_'
    .replace(/=+$/, ''); // Remove ending '='
}

function getCSBData(opts) {
  const { activeAssets, activeAssetsKeys } = opts;
  const nodemodules = getActivePackage(activeAssets);

  const ext = '.tsx';
  const files: Record<string, { content: string }> = {};

  const entryFileName = `src/index${ext}`;

  const { GI_PROJECT_CONFIG, SERVER_ENGINE_CONTEXT, GI_ASSETS_PACKAGE, HTML_HEADER, THEME_STYLE, packages } =
    getConstantFiles(opts);

  const assets_packages_json = packages.reduce((acc, curr) => {
    const { name, version } = curr;
    return {
      ...acc,
      [name]: version,
    };
  }, {});
  const import_pakages = [...nodemodules.componentsMap.keys()]
    .map(key => {
      const UMD = key.replace('@antv/', '').split('-').join('_').toUpperCase();
      console.log('umd', UMD);
      return `import * as ${UMD} from '${key}';`;
    })
    .join('\n');

  const import_components = [...nodemodules.componentsMap.keys()]
    .map(key => {
      const UMD = key.replace('@antv/', '').split('-').join('_').toUpperCase();
      const itemPkg = nodemodules.componentsMap.get(key);

      const componentIds = itemPkg
        .map(itemComponent => {
          return itemComponent.info.id;
        })
        .join(',');
      console.log('umd', UMD);
      return `const { ${componentIds} } = ${UMD}.components;`;
    })
    .join('\n');

  const import_elements = [...nodemodules.elementsMap.keys()]
    .map(key => {
      const UMD = key.replace('@antv/', '').split('-').join('_').toUpperCase();
      const itemPkg = nodemodules.elementsMap.get(key);

      const componentIds = itemPkg
        .map(itemComponent => {
          return itemComponent.info.id;
        })
        .join(',');
      console.log('umd', UMD);
      return `const { ${componentIds} } = ${UMD}.elements;`;
    })
    .join('\n');
  const import_layouts = [...nodemodules.layoutsMap.keys()]
    .map(key => {
      const UMD = key.replace('@antv/', '').split('-').join('_').toUpperCase();
      const itemPkg = nodemodules.layoutsMap.get(key);

      const componentIds = itemPkg
        .map(itemComponent => {
          return itemComponent.info.id;
        })
        .join(',');
      console.log('umd', UMD);
      return `const { ${componentIds} } = ${UMD}.layouts;`;
    })
    .join('\n');

  const import_assets = `
const ASSETS = {
  components:{${activeAssetsKeys.components.join(',')}},
  elements:{${activeAssetsKeys.elements.join(',')}},
  layouts:{${activeAssetsKeys.layouts.join(',')}}
}
    `;
  const import_servers_package = activeAssets.services
    .map(item => {
      const UMD = item.pkg.replace('@antv/', '').split('-').join('_').toUpperCase() + '_SERVER';
      return `import {services as ${UMD}} from '${item.pkg}';`;
    })
    .join('\n');

  const import_servers = `
const SERVER = [
  ${activeAssets.services
    .map(item => {
      return item.pkg.replace('@antv/', '').split('-').join('_').toUpperCase() + '_SERVER';
    })
    .join(',')}
  ]
    `;

  console.log('assets_import_components', import_pakages, import_components);

  files['src/GI_EXPORT_FILES.ts'] = {
    content: ` 
      /** 动态请求需要的配套资产 **/
      export const GI_ASSETS_PACKAGE = ${GI_ASSETS_PACKAGE};

      /** GraphInsight 站点自动生成的配置 **/
      export const GI_PROJECT_CONFIG = ${GI_PROJECT_CONFIG};
      
      /** GraphInsight 站点选择服务引擎的上下文配置信息 **/
      export const SERVER_ENGINE_CONTEXT = ${SERVER_ENGINE_CONTEXT};
    `,
  };

  files['src/index.tsx'] = {
    content: `
import React from "react";
import ReactDOM from "react-dom";
import GISDK,{utils} from '@antv/gi-sdk';

${import_pakages}
${import_servers_package}
import {  GI_PROJECT_CONFIG, SERVER_ENGINE_CONTEXT,GI_ASSETS_PACKAGE,THEME_VALUE } from "./GI_EXPORT_FILES";  
import ThemeSwitch from '@antv/gi-theme-antd';
/** 资产可按需引入 **/
${import_components}
${import_elements}
${import_layouts}
${import_assets}
${import_servers}



const {  getCombineServices } = utils;
const services = getCombineServices(SERVER);
/** 设置服务引擎 Context **/
window.localStorage.setItem( 'SERVER_ENGINE_CONTEXT', JSON.stringify(SERVER_ENGINE_CONTEXT));
/** 设置主题 **/
window.localStorage.setItem("@theme", THEME_VALUE);

const MyGraphApp= (props) => {
   
   React.useEffect(()=>{
  
   },[]);
   return (
     <div>
       <div style={{ height: "100vh" }}>
         <ThemeSwitch style={{ visibility: "hidden" }} />
         {/** @ts-ignore */}
         <GISDK
           config={GI_PROJECT_CONFIG}
           assets={ASSETS}
           services={services}
         />
       </div>
     </div>
   );
 };
 
 
ReactDOM.render(<MyGraphApp />, document.getElementById("root"));
 
 
    `,
  };

  files['package.json'] = {
    content: JSON.stringify(
      {
        name: '',
        description: '',
        main: entryFileName,
        dependencies: {
          react: '17.x',
          'react-dom': '17.x',
          antd: ANTD_VERSION,
          '@antv/g6': G6_VERSION,
          '@antv/graphin': GRAPHIN_VERSION,
          '@antv/gi-sdk': GI_VERSION,
          ...assets_packages_json,
        },
        devDependencies: { typescript: '^3' },
      },
      null,
      2,
    ),
  };

  return serialize({ files });
}

export default opts => {
  const [handler, setHandler] = useState<(...args: any) => void | undefined>();

  useEffect(() => {
    if (opts) {
      const form = document.createElement('form');
      const input = document.createElement('input');
      const data = getCSBData(opts);

      form.method = 'POST';
      form.target = '_blank';
      form.style.display = 'none';
      form.action = CSB_API_ENDPOINT;
      form.appendChild(input);
      form.setAttribute('data-demo', opts.title || '');

      input.name = 'parameters';
      input.value = data;

      document.body.appendChild(form);

      setHandler(() => () => form.submit());

      return () => form.remove();
    }
  }, [opts]);

  return handler;
};
