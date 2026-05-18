import type { Component } from 'vue'
import type { NodePath } from '@babel/traverse'
import fs from 'node:fs'
import path from 'node:path'
import { Plugin } from 'vite'
import * as t from '@babel/types'
import { parse } from '@babel/parser'
import traverseModule from '@babel/traverse'

const traverse = (traverseModule as any).default || traverseModule

interface RecordMainRaw {
  children?: RecordMainRaw[]
  component?: Component | string
  name?: string
  path?: string
  redirect?: string
  meta?: {
    title?: any
    i18n?: string
    icon?: string
    activeIcon?: string
    auth?: string | string[]
    menuCode: string
  }
}

interface IMenuRecord extends RecordMainRaw
{
  appCode: string
  component?: string
  enabled: boolean
  menuCode: string
  menuName: string
  menuRoleType: number
  menuType: number
  orderNum: number
  parentMenuCode?: string
  routeName?: string
  routePath?: string
}

export interface IGenerateMenuOptions
{
  /** 别名替换， 默认 { @: 'src' } */
  alias?: Record<string, string>
  /** 应用编码 */
  appCode: string
  /** 入口 */
  entry: string
  /** 输出文件名，默认menu */
  filename?: string
  /** 菜单标识符，默认 menuCode */
  menuIdentifier?: string
  /** 动态路由变量名 */
  menuVariable: string[]
  /** 包含的菜单模块编码, 默认所有 */
  modules?: string[]
  /** 出口，默认根目录下的menu文件夹 */
  outputDir?: string
}

/**
 * 辅助函数：获取节点的实际值
 * 该函数用于遍历AST（抽象语法树）节点并提取其实际值
 * @param node - AST节点
 * @param context - 上下文对象，用于存储和查找变量值，默认为空对象
 * @returns 返回节点的实际值，可能是字符串、数字、布尔值、对象或数组等
 */
function getNodeValue(node: t.Node, context: Record<string, string> = {}): any
{
  switch (node.type)
  {
    // 处理字面量类型：字符串、数字、布尔值
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral': {
      return node.value
    }

    // 处理标识符：从上下文中查找变量值，如果找不到则返回标识符名称
    case 'Identifier': {
      return context[node.name] || node.name
    }

    // 处理成员表达式（如 obj.property）
    case 'MemberExpression': {
      return `${getNodeValue(node.object, context)}`
    }

    // 处理函数调用表达式（如 func(arg1, arg2)）
    case 'CallExpression': {
      return `${getNodeValue(node.callee, context)}(${node.arguments.map(arg => getNodeValue(arg, context)).join(', ')})`
    }

    // 处理对象表达式（如 { key: value }）
    case 'ObjectExpression': {
      const obj: Record<string, any> = {}
      const properties = node.properties as any
      properties.forEach((prop: t.ObjectProperty) =>
      {
        const key = (prop.key as t.Identifier).name
        obj[key] = getNodeValue(prop.value, context)
      })
      return obj
    }

    // 处理数组表达式（如 [elem1, elem2]）
    case 'ArrayExpression': {
      return node.elements.map(element => element && getNodeValue(element, context))
    }

    // 处理箭头函数表达式（如 () => value）
    case 'ArrowFunctionExpression': {
      // 特殊处理：如果函数体是Import调用，则提取导入路径并移除前缀
      if (node.body.type === 'CallExpression' && node.body.callee.type === 'Import')
      {
        return (node.body.arguments[0] as t.StringLiteral).value.replace(/^@\/views\//, '')
      }
      return null
    }

    // 处理变量声明（如 const name = value）
    case 'VariableDeclarator': {
      const variableName = (node.id as t.Identifier).name
      const variableValue: string = getNodeValue(node.init!, context)
      // 将变量名和值存入上下文，供后续使用
      context[variableName] = variableValue
      return { [variableName]: variableValue }
    }

    // 处理TypeScript类型断言表达式（如 expr as Type）
    case 'TSAsExpression': {
      // 忽略类型注解，只处理实际的表达式
      return getNodeValue(node.expression, context)
    }

    // 默认情况：不处理其他类型的节点
    default: {
      break
    }
  }
}

/**
 * 读取并解析模块文件内容
 * 该函数用于读取路由配置文件，解析其中的导出内容，提取路由信息
 * @param modulePath - 模块路径
 * @param baseDir - 基础目录，用于解析相对路径
 * @param rootRoutes - 根路由children下的路由模块名数组，如 ['broadcastRoutes', 'userRoutes']
 * @returns 返回导出的路由值数组，包含所有符合条件的路由配置
 */
function readModuleFile(modulePath: string, baseDir: string, rootRoutes: string[], alias: Record<string, string>)
{
  // 步骤1：解析模块路径为绝对路径
  const keys = Object.keys(alias)
  const key = keys.find(key => modulePath.startsWith(key))
  const transformPath = key ? modulePath.replace(key, alias[key]) : modulePath
  // 1.绝对路径 如：src/xxx, assets/xxx
  // 2.相对路径 如：./xxx, ../xxx
  const modulePathNew = transformPath.startsWith('/') ? transformPath.slice(1) : transformPath
  const absolutePath = modulePathNew.startsWith('.')
    ? path.resolve(baseDir, `${modulePathNew}.ts`)
    : path.resolve(process.cwd(), `${modulePathNew}.ts`)

  /**
   * 步骤2：读取文件内容并解析为AST
   * 使用Babel解析器将TypeScript代码解析为抽象语法树
   */
  const fileContent = fs.readFileSync(absolutePath, 'utf8')
  const ast = parse(fileContent, { sourceType: 'module', plugins: ['typescript'] })

  /**
   * 步骤3：初始化数据结构
   * exportedValues: 存储所有导出的路由值
   * replacements: 存储变量名到其值的映射，用于解析变量引用
   */
  const exportedValues: any[] = []
  const replacements: Record<string, string> = {}

  /**
   * 步骤4：遍历AST，提取路由信息
   */
  traverse(ast, {
    /**
     * 处理命名导出声明
     * 导出格式如：export const broadcastRoutes = [...]
     * 这种导出方式通常用于定义根路由下的子路由模块
     */
    ExportNamedDeclaration(path: NodePath<t.ExportNamedDeclaration>)
    {
      // 获取导出声明中的变量声明部分
      const declaration = path.node.declaration as t.VariableDeclaration
      if (declaration && declaration.declarations)
      {
        // 遍历所有声明的变量
        declaration.declarations.forEach((decl) =>
        {
          // 获取变量名
          const rootRouteName = (decl.id as t.Identifier).name
          // 获取变量的实际值
          const value = getNodeValue(decl.init!, replacements)

          // 只处理在rootRoutes数组中指定的路由模块
          if (rootRoutes?.length && rootRoutes.includes(rootRouteName))
          {
            const isExits = exportedValues.find(item => item?.name === value.name)
            if (!isExits)
            {
              exportedValues.push(value)
            }
          }
        })
      }
    },

    /**
     * 处理默认导出声明
     * 导出格式如：export default [...] 或 export default routes
     * 这种导出方式通常用于导出主路由配置
     */
    ExportDefaultDeclaration(path: NodePath<t.ExportDefaultDeclaration>)
    {
      const declaration = path.node.declaration
      // 1.从上下文中找出标识符对应的内容
      // 2.其他表达式（如数组、对象等）直接获取其值
      const value = declaration.type === 'Identifier'
        ? replacements[declaration.name]
        : getNodeValue(declaration, replacements)

      const isExit = exportedValues.find(item => item?.name === value.name)
      if (!isExit)
      {
        exportedValues.push(value)
      }
    },

    /**
     * 处理变量声明
     * 导出格式如：const routes = [...]，然后在默认导出中使用children: routes
     * 这种情况下，需要先收集变量的值，以便在解析导出时使用
     * replacements对象用于存储变量名到其值的映射
     */
    VariableDeclaration(path: NodePath<t.VariableDeclaration>)
    {
      path.node.declarations.forEach((declaration) =>
      {
        // 获取变量名
        const varName = (declaration.id as t.Identifier).name
        // 将变量名映射到其实际值（递归解析变量引用）
        replacements[varName] = getNodeValue(declaration.init!, replacements)
      })
    },
  })

  // 返回所有导出的路由值
  return exportedValues
}

/**
 * 递归处理路由树，将树形结构打平
 * @param routes 路由树数组
 * @returns 扁平化后的菜单数组
 */
function getMenuList(routes: IMenuRecord[])
{
  return routes?.reduce<IMenuRecord[]>((acc, route) =>
  {
    acc.push(route)
    if (route.children?.length)
    {
      acc.push(...getMenuList(route.children as IMenuRecord[]))
    }
    return acc
  }, []) ?? []
}

/**
 * 判断是否为异步路由次根节点
 * - 左侧菜单为根级：depth: 0
 * - 异步路由次根节点：depth: 1
 * @param node 菜单节点
 * @param depth 层级
 */
function isSubRootNode(node: IMenuRecord, depth: number)
{
  return node.children?.length && depth === 1
}

/**
 * 添加自定义属性
 * @param route 当前路由对象
 * @param index 排序
 * @param parentMenuCode 父级分类编码
 * @param depth 路由层级
 */
function addCustomProperties(route: IMenuRecord, index: number, parentMenuCode: string, depth: number, appCode: string)
{
  const { path, name, component, ...routeInfo } = route
  // 菜单编码通过 . 符合链接表示层级关系，因此需要转换路径
  // 路径可能的形式：/xxx/config 或 xxx/config 或 xxx
  // 统一处理：移除开头的/（如果有），然后将所有/替换为.
  const currentPath = path?.replace(/^\/?/, '').replaceAll('/', '.')
  // 是否为菜单根节点
  const isRoot = routeInfo?.meta?.menuCode
  // 设置菜单编码
  const code = `${parentMenuCode}.${currentPath}`
  const menuCode = isRoot ? parentMenuCode : code
  // 获取菜单名称
  const menuName = typeof route.meta?.title === 'function' ? route.meta?.title?.() : route.meta?.title
  const newRoute: IMenuRecord = {
    ...routeInfo,
    menuName,
    menuCode,
    menuType: 1,
    menuRoleType: route.children && route.children.length > 0 ? 1 : 2,
    enabled: true,
    orderNum: index + 1,
    appCode,
  }

  // 第一层节点是文件夹并非路由
  if (!isRoot)
  {
    newRoute.routeName = name
    newRoute.parentMenuCode = parentMenuCode
    // 确保次级菜单的路径以 / 开头
    newRoute.routePath = isSubRootNode(route, depth) && !path!.includes('/') ? `/${path}` : path
  }

  // 递归处理
  if (route.children && route.children.length > 0)
  {
    newRoute.children = route.children.map((child, childIndex) =>
      addCustomProperties(child as IMenuRecord, childIndex, menuCode, depth + 1, appCode),
    )
  }
  else
  {
    // 仅最后一层路由需要添加
    newRoute.component = component
    newRoute.children = []
  }

  return newRoute
}

/**
 * 根据路由配置自动生成菜单配置
 */
export default function createGenerateMenu(options: IGenerateMenuOptions): Plugin
{
  return {
    name: 'vite-plugin-menus-generation',
    transform(code: string, id: string)
    {
      const entryPath = options.entry.replaceAll('\\', '/')

      if (entryPath !== id)
      {
        return
      }

      const defaultAlias = { '@': 'src' }
      const { appCode, menuVariable, outputDir, modules = [], filename = 'menu', menuIdentifier = 'menuCode', alias = defaultAlias } = options

      if (!appCode)
      {
        throw new Error('appCode cannot be empty')
      }

      if (!menuVariable)
      {
        throw new Error('menuVariable cannot be empty')
      }

      const ast = parse(code, { sourceType: 'module', plugins: ['typescript'] })

      /**
       * 遍历AST，提取关键信息
       * 1. 查找目标菜单变量的声明，获取其初始化表达式
       * 2. 收集所有import声明，建立导入名称到模块路径的映射
       */

      // 存储异步路由节点的初始化表达式
      const asyncRoutesNode: t.Expression[] = []
      // 存储import导入映射：key为导入的本地名称，value为模块路径
      const imports: Record<string, string> = {}

      traverse(ast, {
        /**
         * 处理变量声明节点
         * 查找目标菜单变量的声明语句
         * 例如：const routes = [...] 中的 routes 变量
         */
        VariableDeclarator(path: NodePath<t.VariableDeclarator>)
        {
          // 检查当前声明的变量名是否与目标菜单变量名匹配
          const variableName = (path.node.id as t.Identifier).name
          if (menuVariable.includes(variableName) && path.node.init)
          {
            // 保存变量的初始化表达式（即路由配置数组或对象）
            asyncRoutesNode.push(path.node.init)
          }
        },
        /**
         * 处理import声明节点
         * 收集所有import语句，建立导入名称到模块路径的映射
         * 例如：import { Layout } from '@/layouts' 会记录 { Layout: '@/layouts' }
         */
        ImportDeclaration(path: NodePath<t.ImportDeclaration>)
        {
          // 获取import语句中的模块路径
          const modulePath = path.node.source.value
          // 遍历该import语句中的所有导入说明符
          path.node.specifiers.forEach((specifier) =>
          {
            // 将导入的本地名称映射到模块路径
            // 例如：import { Home } from './views' -> imports['Home'] = './views'
            imports[specifier.local.name] = modulePath
          })
        },
      })

      if (asyncRoutesNode.length === 0)
      {
        throw new Error('not exist async routes node')
      }

      // 动态路由对象数组
      const elementArr = (asyncRoutesNode as t.ArrayExpression[]).flatMap(node => node.elements)
      const elements = elementArr.filter(el => (el !== null) && el.type === 'ObjectExpression')
      // 处理后的菜单数组
      const routes = elements.map((element, index) =>
      {
        let value: any
        let menuCode = ''
        const route: Record<string, any> = {}
        const properties = (element as t.ObjectExpression).properties as t.ObjectProperty[]

        properties.forEach((property) =>
        {
          value = getNodeValue(property.value, imports)
          if ((property.key as t.Identifier).name === 'meta')
          {
            const metaProperties = (property.value as t.ObjectExpression).properties as t.ObjectProperty[]
            const menuProperty = metaProperties.find(item => (item.key as t.Identifier).name === menuIdentifier)

            if (!menuProperty)
            {
              throw new Error('Please add menuCode property to each route module!!')
            }

            const menuValue = (menuProperty.value as t.StringLiteral).value

            if (!menuValue)
            {
              throw new Error('menuCode can not be empty!!')
            }

            menuCode = menuValue
          }

          if ((property.key as t.Identifier).name === 'children')
          {
            /**
             * 处理动态路由下的所有子路由
             * children: [HomeRoute, UserRoutes.login]
             * result: [HomeRoute, login]
             */
            const rootRoutes: string[] = []
            if (property.value.type === 'ArrayExpression')
            {
              property.value.elements.forEach((element) =>
              {
              // 例如：children: [HomeRoute] 中的 HomeRoute
                let eleName = (element as t.Identifier).name
                // 例如：UserRoutes.login 中的 login
                if (element?.type === 'MemberExpression')
                {
                  eleName = ((element as t.MemberExpression).property as t.Identifier).name
                }
                rootRoutes.push(eleName)
              })
            }

            // 子路由中所有导入的模块对应的路径
            // value: ['./module/home', './module/user']
            // 导入的模块可能来自同一个文件，故需要去重
            const children = [...new Set(value)] as string[]
            // 解析子路由中的模块
            const baseDir = path.dirname(id)
            const routeModules = children.map((child) =>
            {
              return typeof child === 'string' ? readModuleFile(child, baseDir, rootRoutes, alias) : child
            })
            value = routeModules.flat()
          }

          const key = (property.key as t.Identifier).name
          route[key] = value
        })

        // 添加自定义属性
        return addCustomProperties(route as IMenuRecord, index, menuCode, 0, appCode)
      })

      // 最终输出的路由对象数组
      const routerRes = modules.length > 0 ? routes : routes.filter(item => item.menuCode)
      // 转换为指定的数据格式菜单
      const menuList = getMenuList(routerRes)
      // 输出文件
      const filenameRes = filename.endsWith('.json') ? filename : `${filename}.json`
      // 输出目录
      const menuDirRes = outputDir ?? path.join(process.cwd(), 'menu')
      if (!fs.existsSync(menuDirRes))
      {
        fs.mkdirSync(menuDirRes)
      }
      // 写入文件
      const outputPath = path.join(menuDirRes, filenameRes)
      fs.writeFileSync(outputPath, JSON.stringify(menuList, null, 2), 'utf8')
    },
  }
}
